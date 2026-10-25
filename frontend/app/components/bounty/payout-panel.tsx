"use client";

import { useState } from "react";
import { address, sol, solToLamports, type Address } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { toast } from "sonner";
import { useAppClient } from "../../lib/client-provider";
import { useSend } from "../../lib/hooks/use-send";
import { useCluster } from "../cluster-context";
import {
  verifyPr,
  type PrVerification,
  type RecommendedIssue,
} from "../../lib/api";
import {
  buildBountyMemo,
  isPullRequestUrl,
  MAX_MEMO_BYTES,
  memoByteLength,
  parseBountyMemo,
} from "../../lib/memo";
import { fetchReceipt, type Receipt } from "../../lib/receipt";

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
  // read back from the chain after paying; null while checking
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  // the GitHub check is tied to the exact URL it was run for; editing the URL invalidates it
  const [check, setCheck] = useState<{
    url: string;
    result: PrVerification;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const record = { repo, issueNumber: quest.issue.number, prUrl };
  const memo = buildBountyMemo(record);
  const contributorAddr = toAddress(contributor);
  const currentCheck =
    check && check.url === prUrl.trim() ? check.result : null;
  const prVerified = currentCheck?.ok === true;

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyPr(repo, quest.issue.number, prUrl);
      setCheck({ url: prUrl.trim(), result });
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }

  const problems = [
    !connected && "Connect the maintainer wallet (top right)",
    isPullRequestUrl(prUrl) && !prVerified && "Verify the PR on GitHub first",
    contributor && !contributorAddr && "Contributor address is not valid",
    prUrl &&
      !isPullRequestUrl(prUrl) &&
      "PR link must look like https://github.com/owner/repo/pull/123",
    amountError(amount),
    memoByteLength(memo) > MAX_MEMO_BYTES &&
      "PR link is too long for an on-chain memo",
  ].filter(Boolean) as string[];

  const ready =
    connected &&
    contributorAddr &&
    isPullRequestUrl(prUrl) &&
    prVerified &&
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
            <a
              href={getExplorerUrl(`/tx/${existing}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
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

    // Pin what we expect now, so later edits to the form can't change the check.
    const expected = {
      maintainer: signer.address,
      contributor: contributorAddr,
      lamports: solToLamports(sol(amount)),
      memo,
    };

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
      setReceipt(null);
      setReceiptError(null);
      onPaid(contributorAddr);
      try {
        setReceipt(await fetchReceipt(client.rpc, sig, expected));
      } catch (e) {
        setReceiptError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  return (
    <div className="pixel-box p-4 sm:p-5">
      <p className="text-muted">
        Quest:{" "}
        <span className="text-foreground">
          #{quest.issue.number} {quest.issue.title}
        </span>
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
          <div className="mt-1 flex gap-2">
            <input
              className="pixel-input"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              spellCheck={false}
              autoCapitalize="none"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={!isPullRequestUrl(prUrl) || verifying}
              className="pixel-btn shrink-0 !px-3 bg-violet text-white"
            >
              {verifying ? "..." : "Verify"}
            </button>
          </div>
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

      {verifyError && (
        <p className="mt-3 text-destructive" role="alert">
          ! {verifyError}
        </p>
      )}
      {currentCheck && (
        <div
          className={`mt-4 border-3 p-3 ${currentCheck.ok ? "border-neon" : "border-destructive"}`}
          role="status"
        >
          <p className="font-pixel text-[0.55rem]">
            GITHUB CHECK:{" "}
            <span
              className={currentCheck.ok ? "text-neon" : "text-destructive"}
            >
              {currentCheck.ok ? "PASSED" : "FAILED"}
            </span>
          </p>
          <ul className="mt-2 space-y-0.5">
            <li>
              {currentCheck.repo_matches
                ? `✓ PR is in ${repo}`
                : `✗ ${currentCheck.reason}`}
            </li>
            {currentCheck.repo_matches && (
              <li>
                {currentCheck.merged ? "✓" : "✗"}{" "}
                {currentCheck.merged
                  ? `Merged ${currentCheck.merged_at ? new Date(currentCheck.merged_at).toLocaleDateString() : ""}`
                  : currentCheck.reason}
              </li>
            )}
            {currentCheck.merged && (
              <li className={currentCheck.mentions_issue ? "" : "text-gold"}>
                {currentCheck.mentions_issue
                  ? `✓ PR references issue #${quest.issue.number}`
                  : `~ PR doesn't mention #${quest.issue.number}. Confirm it fixes the issue yourself.`}
              </li>
            )}
            {currentCheck.title && (
              <li className="text-muted">
                &ldquo;{currentCheck.title}&rdquo; by @{currentCheck.author}
              </li>
            )}
          </ul>
        </div>
      )}

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--gold)]"
        />
        <span>
          I&apos;m the maintainer. I reviewed this PR and approve paying this
          bounty.
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
          <div
            className={`mt-3 border-t-3 pt-3 text-left ${receipt && !receipt.ok ? "border-destructive" : "border-neon"}`}
            role="status"
            data-testid="onchain-receipt"
          >
            <p className="font-pixel text-[0.55rem]">
              ON-CHAIN RECEIPT:{" "}
              {receipt ? (
                <span className={receipt.ok ? "text-neon" : "text-destructive"}>
                  {receipt.ok ? "VERIFIED" : "MISMATCH"}
                </span>
              ) : receiptError ? (
                <span className="text-gold">NOT FOUND YET</span>
              ) : (
                <span className="text-muted">READING DEVNET...</span>
              )}
            </p>
            {receipt && (
              <ul className="mt-2 space-y-0.5">
                {receipt.checks.map((c) => (
                  <li key={c.label} className={c.ok ? "" : "text-destructive"}>
                    {c.ok ? "✓" : "✗"} {c.label}
                  </li>
                ))}
              </ul>
            )}
            {receiptError && (
              <p className="mt-2 text-muted">
                {receiptError}. Check it on the explorer link above.
              </p>
            )}
            <p className="mt-2 text-muted">
              Read back from the chain, not from the wallet&apos;s reply.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
