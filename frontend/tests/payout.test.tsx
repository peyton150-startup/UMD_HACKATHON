/**
 * End-to-end payout test against a LOCAL chain (never Devnet or Mainnet).
 *
 * Start an offline Surfpool chain first (Windows: inside WSL), e.g.
 *   wsl -d Ubuntu -- bash -lc "surfpool start --offline --no-tui"
 * then run: npx vitest run tests/payout.test.tsx
 *
 * Override the endpoint with SURFPOOL_RPC_URL / SURFPOOL_WS_URL. If nothing is
 * listening, the whole suite is skipped rather than failing.
 */
import {
  address,
  createSolanaRpc,
  generateKeyPair,
  getAddressFromPublicKey,
  lamports,
} from "@solana/kit";
import { ClientProvider } from "@solana/react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMemo } from "react";
import { Toaster } from "sonner";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Ledger } from "../app/components/bounty/ledger";
import { PayoutPanel } from "../app/components/bounty/payout-panel";
import { ClusterProvider } from "../app/components/cluster-context";
import { WalletButton } from "../app/components/wallet-button";
import type { PrVerification, RecommendedIssue } from "../app/lib/api";
import { buildBountyMemo } from "../app/lib/memo";
import { createAppClient } from "../app/lib/solana-client";
import { mockWalletAddress, registerMockWallet, resetMockWallet } from "./mock-wallet";

const RPC_URL = process.env.SURFPOOL_RPC_URL ?? "http://127.0.0.1:8899";
const WS_URL = process.env.SURFPOOL_WS_URL ?? "ws://127.0.0.1:8900";
const LAMPORTS_PER_SOL = 1_000_000_000n;
const BOUNTY_LAMPORTS = 50_000_000n; // the panel's default 0.05 SOL

const REPO = "o/r";
const PR_URL = "https://github.com/o/r/pull/9";
const QUEST: RecommendedIssue = {
  issue: { number: 7, title: "Fix typo in docs", body: "", labels: [], url: "https://github.com/o/r/issues/7" },
  fit_score: 90,
  rationale: "test",
  steps: ["do it"],
  files_to_look_at: [],
};

async function chainIsUp(): Promise<boolean> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    });
    return (await res.json()).result === "ok";
  } catch {
    return false;
  }
}

const up = await chainIsUp();
const rpc = createSolanaRpc(RPC_URL);

async function balance(owner: string): Promise<bigint> {
  const { value } = await rpc.getBalance(address(owner), { commitment: "confirmed" }).send();
  return value;
}

// The backend's /api/verify-pr is stubbed (the GitHub check has its own backend tests);
// every other request, including all Solana RPC calls, goes to the real local chain.
let prMerged = true;
const realFetch = globalThis.fetch;
function stubVerifyPr() {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/api/verify-pr")) {
      const body: PrVerification = {
        ok: prMerged,
        reason: prMerged ? "Merged PR in this repo" : "PR is not merged yet",
        repo_matches: true,
        merged: prMerged,
        mentions_issue: true,
        title: "Fix typo",
        author: "terp",
        merged_at: prMerged ? "2026-10-20T12:00:00Z" : null,
      };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

function TestApp({ contributor }: { contributor: string }) {
  const client = useMemo(
    () => createAppClient("localnet", { rpcUrl: RPC_URL, rpcSubscriptionsUrl: WS_URL }),
    []
  );
  return (
    <ClusterProvider>
      <ClientProvider client={client}>
        <WalletButton />
        <PayoutPanel repo={REPO} quest={QUEST} onPaid={() => {}} />
        <Ledger initialAddress={contributor} />
        <Toaster />
      </ClientProvider>
    </ClusterProvider>
  );
}

async function connectWallet() {
  fireEvent.click(await screen.findByRole("button", { name: "Connect Wallet" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mock Wallet" }));
  await screen.findByRole("button", { name: `Wallet ${mockWalletAddress}` });
}

async function fillPayout(contributor: string) {
  fireEvent.change(screen.getByPlaceholderText("Contributor's Solana address"), {
    target: { value: contributor },
  });
  fireEvent.change(screen.getByPlaceholderText("https://github.com/owner/repo/pull/123"), {
    target: { value: PR_URL },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
  await screen.findByText(prMerged ? "PASSED" : "FAILED");
  fireEvent.click(screen.getByRole("checkbox"));
}

const payButton = () => screen.getByRole("button", { name: /Pay 0\.05 SOL bounty/ });

describe.skipIf(!up)("bounty payout on a local Surfpool chain", () => {
  let contributor: string;

  beforeAll(async () => {
    registerMockWallet();
    stubVerifyPr();
    contributor = await getAddressFromPublicKey((await generateKeyPair()).publicKey);
    // fund the maintainer (mock wallet) on the local chain only
    await rpc.requestAirdrop(address(mockWalletAddress), lamports(2n * LAMPORTS_PER_SOL)).send();
    await waitFor(async () => expect(await balance(mockWalletAddress)).toBeGreaterThan(0n), {
      timeout: 15_000,
    });
  }, 60_000);

  beforeEach(() => {
    localStorage.clear(); // the wallet plugin remembers the last connection
    resetMockWallet();
  });

  afterEach(() => {
    cleanup();
    resetMockWallet();
    prMerged = true;
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  test("Pay stays locked while the PR is not merged", async () => {
    prMerged = false;
    render(<TestApp contributor={contributor} />);
    await connectWallet();
    await fillPayout(contributor);
    expect((payButton() as HTMLButtonElement).disabled).toBe(true);
    expect(await balance(contributor)).toBe(0n);
  });

  test("one transaction moves 0.05 SOL and records the bounty memo", async () => {
    render(<TestApp contributor={contributor} />);
    await connectWallet();
    await fillPayout(contributor);
    expect((payButton() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(payButton());
    await screen.findByText("QUEST COMPLETE!", {}, { timeout: 20_000 });

    expect(await balance(contributor)).toBe(BOUNTY_LAMPORTS);

    const sigs = await rpc.getSignaturesForAddress(address(contributor), { limit: 10 }).send();
    expect(sigs).toHaveLength(1);
    const tx = await rpc
      .getTransaction(sigs[0].signature, {
        encoding: "json",
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      })
      .send();
    expect(tx?.meta?.err).toBeNull();
    // the maintainer's wallet paid the fee and signed
    expect(tx?.transaction.message.accountKeys[0]).toBe(mockWalletAddress);
    // the memo landed in the SAME transaction as the transfer
    const memo = buildBountyMemo({ repo: REPO, issueNumber: QUEST.issue.number, prUrl: PR_URL });
    expect(tx?.meta?.logMessages?.join("\n")).toContain(memo);
    expect(sigs[0].memo).toContain(memo);
  });

  test("paying the same issue to the same contributor again is blocked", async () => {
    render(<TestApp contributor={contributor} />);
    await connectWallet();
    await fillPayout(contributor);

    fireEvent.click(payButton());
    await screen.findByText(/already paid/i, {}, { timeout: 15_000 });
    expect(screen.queryByText("QUEST COMPLETE!")).toBeNull();
    expect(await balance(contributor)).toBe(BOUNTY_LAMPORTS); // unchanged
  });

  test("the on-chain ledger lists the payout", async () => {
    render(<TestApp contributor={contributor} />);
    fireEvent.click(screen.getByRole("button", { name: "Load scores" }));
    // the count is rendered as two text nodes, so match on the element's full text
    await screen.findByText((_, el) => el?.tagName === "P" && el.textContent === "QUESTS CLEARED: 1", {}, { timeout: 15_000 });
    expect(screen.getByText(`${REPO}#${QUEST.issue.number}`)).toBeTruthy();
  });
});
