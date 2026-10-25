"use client";

import { useState } from "react";
import { address, sol, solToLamports, type Address } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { toast } from "sonner";
import { useAppClient } from "../../lib/client-provider";
import { useSend } from "../../lib/hooks/use-send";
import { useCluster } from "../cluster-context";
import type { RecommendedIssue } from "../../lib/api";
import {
  buildBountyMemo,
  isPullRequestUrl,
  MAX_MEMO_BYTES,
  memoByteLength,
  parseBountyMemo,
} from "../../lib/memo";

type Props = {
  repo: string;
  quest: RecommendedIssue;
  onPaid: (contributor: string) => void;
};

function toAddress(value: string): Address | null {
  try {
    return address(value.trim());
  } catch {
    return null;
  }
}

function amountError(amount: string): string | null {
  try {
    return solToLamports(sol(amount)) > 0n ? null : "Amount must be above zero";
  } catch {
    return "Enter a valid SOL amount";
  }
}

export function PayoutPanel({ repo, quest, onPaid }: Props) {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const { run, isSending } = useSend();
  const { getExplorerUrl } = useCluster();

  const [contributor, setContributor] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [amount, setAmount] = useState("0.05");
  const [approved, setApproved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const record = { repo, issueNumber: quest.issue.number, prUrl };
  const memo = buildBountyMemo(record);
  const contributorAddr = toAddress(contributor);

  const problems = [
    !connected && "Connect the maintainer wallet (top right)",
    contributor && !contributorAddr && "Contributor address is not valid",
    prUrl && !isPullRequestUrl(prUrl) && "PR link must look like https://github.com/owner/repo/pull/123",
    amountError(amount),
    memoByteLength(memo) > MAX_MEMO_BYTES && "PR link is too long for an on-chain memo",
  ].filter(Boolean) as string[];

  const ready =
    connected &&
    contributorAddr &&
    isPullRequestUrl(prUrl) &&
    approved &&
    problems.length === 0 &&
    !isSending &&
    !checking;

  /** Look at the contributor's recent transactions for a payout on this same issue. */
  async function alreadyPaid(dest: Address): Promise<string | null> {
    const sigs = await client.rpc
      .getSignaturesForAddress(dest, { limit: 100 })
      .send();
    const hit = sigs.find((s) => {
      const r = parseBountyMemo(s.memo);
      return r?.repo === repo && r.issueNumber === quest.issue.number;
    });
    return hit ? hit.signature : null;
  }

  async function handlePay() {
    if (!ready || !connected?.signer || !contributorAddr) return;
    const signer = connected.signer;

    setChecking(true);
    try {
      const existing = await alreadyPaid(contributorAddr);
      if (existing) {
        toast.error("This issue was already paid to this contributor.", {
          description: (
            <a href={getExplorerUrl(`/tx/${existing}`)} target="_blank" rel="noopener noreferrer" className="underline">
              View earlier payout
            </a>
          ),
        });
        return;
      }
    } catch {
      toast.error("Could not check payout history. Try again.");
      return;
    } finally {
      setChecking(false);
    }

    // One transaction, two instructions: the SOL transfer and its memo record.
    const sig = await run(
      () =>
        client.sendTransaction([
          client.system.instructions.transferSol({
            source: signer,
            destination: contributorAddr,
            amount: solToLamports(sol(amount)),
          }),
          client.memo.instructions.addMemo({ memo, signers: [signer] }),
        ]),
      "Bounty paid · quest complete!"
    );
    if (sig) {
      setSignature(sig);
      onPaid(contributorAddr);
    }
  }

  return (
    <div className="pixel-box p-4 sm:p-5">
      <p className="text-muted">
        Quest: <span className="text-foreground">#{quest.issue.number} {quest.issue.title}</span>
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-muted">Contributor wallet (Devnet)</span>
          <input
            className="pixel-input mt-1"
            value={contributor}
            onChange={(e) => setContributor(e.target.value)}
            placeholder="Contributor's Solana address"
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>
        <label>
          <span className="text-muted">Merged PR link</span>
          <input
            className="pixel-input mt-1"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/pull/123"
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>
        <label>
          <span className="text-muted">Bounty (SOL)</span>
          <input
            className="pixel-input mt-1"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--gold)]"
        />
        <span>
          I&apos;m the maintainer. I reviewed this PR and approve paying this bounty.
          <span className="block text-muted">
            The AI suggests. A human approves. The wallet signs.
          </span>
        </span>
      </label>

      <p className="mt-4 break-all text-muted">
        On-chain memo: <code className="text-neon">{memo}</code>
      </p>

      {problems.length > 0 && (
        <ul className="mt-3 text-destructive" role="alert">
          {problems.map((p) => (
            <li key={p}>! {p}</li>
          ))}
        </ul>
      )}

      <button
        onClick={handlePay}
        disabled={!ready}
        className="pixel-btn mt-4 w-full bg-primary text-primary-foreground"
      >
        {checking
          ? "Checking history..."
          : isSending
            ? "Waiting for wallet..."
            : `🪙 Pay ${amount} SOL bounty`}
      </button>

      {signature && (
        <div className="mt-4 border-3 border-neon p-3 text-center">
          <p className="font-pixel text-[0.65rem] text-neon">QUEST COMPLETE!</p>
          <a
            href={getExplorerUrl(`/tx/${signature}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all underline hover:text-gold"
          >
            View transaction on Solana Explorer
          </a>
        </div>
      )}
    </div>
  );
}
