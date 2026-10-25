"use client";

import { useState } from "react";
import type { Receipt } from "../../lib/receipt";

export type RewardDetails = {
  repo: string;
  issueNumber: number;
  issueTitle: string;
  prUrl: string;
  amount: string;
  maintainer: string;
  contributor: string;
  signature: string;
  explorerUrl: string;
};

export function receiptText(details: RewardDetails): string {
  return [
    "BountyBridge · verified Solana Devnet reward (test SOL)",
    `${details.repo}#${details.issueNumber} · ${details.issueTitle}`,
    `Reward: ${details.amount} SOL`,
    `Contributor: ${details.contributor}`,
    `Payer: ${details.maintainer}`,
    `PR: ${details.prUrl}`,
    `Transaction: ${details.signature}`,
    details.explorerUrl,
  ].join("\n");
}

export function RewardReceipt({
  details,
  receipt,
  error,
}: {
  details: RewardDetails;
  receipt: Receipt | null;
  error: string | null;
}) {
  const [notice, setNotice] = useState("");
  const [fallback, setFallback] = useState(false);
  const verified = receipt?.ok === true;

  async function copy() {
    if (!verified) return;
    try {
      await navigator.clipboard.writeText(receiptText(details));
      setNotice("Receipt copied.");
      setFallback(false);
    } catch {
      setFallback(true);
      setNotice("Select and copy the receipt text below.");
    }
  }

  async function share() {
    if (!verified) return;
    if (!navigator.share) return copy();
    try {
      await navigator.share({
        title: "BountyBridge Devnet reward",
        text: receiptText(details),
      });
      setNotice("Receipt shared.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) await copy();
    }
  }

  return (
    <section
      className="mt-5 border-3 border-neon bg-background p-4 sm:p-5"
      aria-label="Reward receipt"
    >
      <div className="flex flex-wrap justify-between gap-2 border-b-2 border-border-low pb-3">
        <h3 className="font-pixel text-[0.65rem] text-gold">REWARD RECEIPT</h3>
        <span className="border-2 border-violet px-2 text-violet">
          Solana Devnet · test SOL
        </span>
      </div>
      <p className="mt-3 text-xl">{details.issueTitle}</p>
      <a
        className="break-all underline text-neon"
        href={`https://github.com/${details.repo}/issues/${details.issueNumber}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {details.repo}#{details.issueNumber}
      </a>
      <p className="my-4 text-3xl text-gold">
        {details.amount} <span className="text-xl">SOL</span>
      </p>
      <dl className="grid gap-2 text-left">
        <div>
          <dt className="text-muted">Contributor</dt>
          <dd className="break-all">{details.contributor}</dd>
        </div>
        <div>
          <dt className="text-muted">Payer wallet</dt>
          <dd className="break-all">{details.maintainer}</dd>
        </div>
        <div>
          <dt className="text-muted">Pull request</dt>
          <dd>
            <a
              className="break-all underline text-neon"
              href={details.prUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {details.prUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Transaction</dt>
          <dd>
            <a
              className="break-all underline text-neon"
              href={details.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {details.signature}
            </a>
          </dd>
        </div>
      </dl>
      <div
        className={`mt-4 border-t-2 pt-3 ${receipt && !receipt.ok ? "border-destructive" : "border-neon"}`}
        role="status"
        data-testid="onchain-receipt"
      >
        <p className="font-pixel text-[0.55rem]">
          ON-CHAIN RECEIPT:{" "}
          <span
            className={
              verified
                ? "text-neon"
                : receipt
                  ? "text-destructive"
                  : "text-gold"
            }
          >
            {receipt
              ? verified
                ? "VERIFIED"
                : "MISMATCH"
              : error
                ? "NOT FOUND YET"
                : "READING DEVNET..."}
          </span>
        </p>
        {receipt && (
          <ul className="mt-2 space-y-1">
            {receipt.checks.map((check) => (
              <li
                key={check.label}
                className={check.ok ? "" : "text-destructive"}
              >
                {check.ok ? "✓" : "✗"} {check.label}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="mt-2 text-gold">
            {error}. Inspect the transaction in Explorer before paying again.
          </p>
        )}
        <p className="mt-2 text-muted">
          Read back from the chain. Wallet signatures do not verify repository
          maintainer identity.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!verified}
          onClick={copy}
          className="pixel-btn bg-gold text-black"
        >
          Copy receipt
        </button>
        <button
          type="button"
          disabled={!verified}
          onClick={share}
          className="pixel-btn bg-violet text-white"
        >
          Share receipt
        </button>
      </div>
      {!verified && (
        <p className="mt-2 text-muted">
          Sharing unlocks when the payment details are verified.
        </p>
      )}
      {notice && (
        <p className="mt-2 text-neon" role="status">
          {notice}
        </p>
      )}
      {fallback && (
        <textarea
          aria-label="Receipt text"
          readOnly
          value={receiptText(details)}
          rows={9}
          onFocus={(e) => e.currentTarget.select()}
          className="pixel-input mt-3"
        />
      )}
    </section>
  );
}
