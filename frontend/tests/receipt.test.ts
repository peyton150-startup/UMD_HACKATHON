import { getBase58Decoder } from "@solana/kit";
import { MEMO_PROGRAM_ADDRESS } from "@solana-program/memo";
import { describe, expect, test, vi } from "vitest";
import {
  checkReceipt,
  fetchReceipt,
  type ReceiptExpected,
  type ReceiptTx,
} from "../app/lib/receipt";

const MAINTAINER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const CONTRIBUTOR = "EUaMzRo8UTcv7HJmnjNnLfU4yrr1YR4uBEMQvEQNyuMC";
const SYSTEM = "11111111111111111111111111111111";
const MEMO =
  "bountybridge:v1|collective/icalendar#12|https://github.com/collective/icalendar/pull/1989";

const want: ReceiptExpected = {
  maintainer: MAINTAINER,
  contributor: CONTRIBUTOR,
  lamports: 50_000_000n,
  memo: MEMO,
};

const b58 = (s: string) =>
  getBase58Decoder().decode(new TextEncoder().encode(s));

function tx(over: {
  err?: unknown;
  received?: bigint;
  memo?: string;
  signers?: number;
}): ReceiptTx {
  const received = over.received ?? 50_000_000n;
  return {
    meta: {
      err: over.err ?? null,
      preBalances: [2_000_000_000n, 0n, 1n, 1n],
      postBalances: [2_000_000_000n - received - 5000n, received, 1n, 1n],
    },
    transaction: {
      message: {
        accountKeys: [MAINTAINER, CONTRIBUTOR, SYSTEM, MEMO_PROGRAM_ADDRESS],
        header: { numRequiredSignatures: over.signers ?? 1 },
        instructions: [
          { programIdIndex: 2, data: "3Bxs4NN8M2Yn4TLb" },
          { programIdIndex: 3, data: b58(over.memo ?? MEMO) },
        ],
      },
    },
  };
}

describe("checkReceipt", () => {
  test("a correct payout passes every check", () => {
    const r = checkReceipt(tx({}), want);
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => c.label)).toEqual([
      "Transaction succeeded",
      "0.05 SOL received by the contributor",
      "Bounty memo recorded in the same transaction",
      "Signed by the maintainer's wallet",
    ]);
  });

  test("flags a wrong amount", () => {
    const r = checkReceipt(tx({ received: 10_000_000n }), want);
    expect(r.ok).toBe(false);
    expect(r.checks[1]).toEqual({
      ok: false,
      label: "Contributor received 0.01 SOL, expected 0.05",
    });
  });

  test("flags a missing or different memo", () => {
    const r = checkReceipt(tx({ memo: "something else" }), want);
    expect(r.ok).toBe(false);
    expect(r.checks[2].ok).toBe(false);
  });

  test("flags a transaction the maintainer did not sign", () => {
    const r = checkReceipt(tx({}), {
      ...want,
      maintainer: "GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSMQRdW",
    });
    expect(r.ok).toBe(false);
    expect(r.checks[3].ok).toBe(false);
  });

  test("flags a failed transaction", () => {
    const r = checkReceipt(
      tx({ err: { InstructionError: [0, "Custom"] } }),
      want
    );
    expect(r.ok).toBe(false);
    expect(r.checks[0].ok).toBe(false);
    expect(r.checks[1].ok).toBe(false);
  });
});

describe("fetchReceipt", () => {
  test("retries until the transaction shows up", async () => {
    const results = [null, null, tx({})];
    const send = vi.fn(async () => results.shift());
    const rpc = { getTransaction: vi.fn(() => ({ send })) };
    const r = await fetchReceipt(rpc, "sig", want, { delayMs: 1 });
    expect(r.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(3);
  });

  test("gives up after the last attempt", async () => {
    const rpc = { getTransaction: () => ({ send: async () => null }) };
    await expect(
      fetchReceipt(rpc, "sig", want, { attempts: 2, delayMs: 1 })
    ).rejects.toThrow("not found");
  });
});
