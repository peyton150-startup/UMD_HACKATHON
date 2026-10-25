// "Verified on-chain" receipt: after a payout, read the transaction back from the
// chain and check it did what the UI claimed, instead of trusting the wallet's reply.
import { getBase58Encoder, type Signature } from "@solana/kit";
import { MEMO_PROGRAM_ADDRESS } from "@solana-program/memo";

/** The parts of a `getTransaction(…, { encoding: "json" })` result we read. */
export type ReceiptTx = {
  meta: {
    err: unknown;
    preBalances: readonly (bigint | number)[];
    postBalances: readonly (bigint | number)[];
  } | null;
  transaction: {
    message: {
      accountKeys: readonly string[];
      header: { numRequiredSignatures: number };
      instructions: readonly { programIdIndex: number; data: string }[];
    };
  };
};

export type ReceiptExpected = {
  maintainer: string;
  contributor: string;
  lamports: bigint;
  memo: string;
};

export type ReceiptCheck = { ok: boolean; label: string };

export type Receipt = { ok: boolean; checks: ReceiptCheck[] };

function formatSol(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n;
  const frac = (lamports % 1_000_000_000n).toString().padStart(9, "0");
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : `${whole}`;
}

function memosIn(tx: ReceiptTx): string[] {
  const { accountKeys, instructions } = tx.transaction.message;
  const bytes = getBase58Encoder();
  const text = new TextDecoder();
  return instructions
    .filter((ix) => accountKeys[ix.programIdIndex] === MEMO_PROGRAM_ADDRESS)
    .map((ix) => text.decode(bytes.encode(ix.data) as Uint8Array));
}

/** Pure check of a fetched transaction against what the payout was supposed to do. */
export function checkReceipt(tx: ReceiptTx, want: ReceiptExpected): Receipt {
  const { accountKeys, header } = tx.transaction.message;
  const succeeded = tx.meta != null && tx.meta.err == null;

  const destIndex = accountKeys.indexOf(want.contributor);
  const received =
    succeeded && destIndex >= 0
      ? BigInt(tx.meta!.postBalances[destIndex]) -
        BigInt(tx.meta!.preBalances[destIndex])
      : 0n;

  const signerIndex = accountKeys.indexOf(want.maintainer);
  const signedByMaintainer =
    signerIndex >= 0 && signerIndex < header.numRequiredSignatures;

  const memoFound = memosIn(tx).includes(want.memo);

  const checks: ReceiptCheck[] = [
    {
      ok: succeeded,
      label: succeeded
        ? "Transaction succeeded"
        : "Transaction failed on-chain",
    },
    {
      ok: received === want.lamports,
      label:
        received === want.lamports
          ? `${formatSol(received)} SOL received by the contributor`
          : `Contributor received ${formatSol(received)} SOL, expected ${formatSol(want.lamports)}`,
    },
    {
      ok: memoFound,
      label: memoFound
        ? "Bounty memo recorded in the same transaction"
        : "Bounty memo not found in the transaction",
    },
    {
      ok: signedByMaintainer,
      label: signedByMaintainer
        ? "Signed by the maintainer's wallet"
        : "Not signed by the maintainer's wallet",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

type ReceiptRpc = {
  getTransaction: (
    signature: Signature,
    config: {
      encoding: "json";
      maxSupportedTransactionVersion: 0;
      commitment: "confirmed";
    }
  ) => { send: () => Promise<unknown> };
};

/**
 * Fetch the transaction and check it. A just-confirmed transaction can take a
 * moment to show up in getTransaction, so retry a few times before giving up.
 */
export async function fetchReceipt(
  rpc: ReceiptRpc,
  signature: string,
  want: ReceiptExpected,
  { attempts = 8, delayMs = 1500 } = {}
): Promise<Receipt> {
  for (let i = 0; i < attempts; i++) {
    const tx = (await rpc
      .getTransaction(signature as Signature, {
        encoding: "json",
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      })
      .send()) as ReceiptTx | null;
    if (tx) return checkReceipt(tx, want);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Transaction not found on-chain yet");
}
