"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { address } from "@solana/kit";
import { useAppClient } from "../../lib/client-provider";
import { useCluster } from "../cluster-context";
import { parseBountyMemo, type BountyRecord } from "../../lib/memo";

type Row = BountyRecord & { signature: string; time: Date | null };

/**
 * High-score table: every BountyBridge payout a wallet has received,
 * read straight from the chain (no database).
 */
export function Ledger({
  initialAddress,
  autoLoad = false,
}: {
  initialAddress: string;
  /** load immediately (used for shared ?wallet= profile links) */
  autoLoad?: boolean;
}) {
  const client = useAppClient();
  const { getExplorerUrl } = useCluster();
  const [wallet, setWallet] = useState(initialAddress);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAddress, setLoadedAddress] = useState<string | null>(null);

  async function load() {
    setError(null);
    let addr;
    try {
      addr = address(wallet.trim());
    } catch {
      setError("Not a valid Solana address");
      return;
    }
    setLoading(true);
    try {
      const sigs = await client.rpc
        .getSignaturesForAddress(addr, { limit: 200 })
        .send();
      const parsed: Row[] = [];
      for (const s of sigs) {
        const record = parseBountyMemo(s.memo);
        if (record && !s.err) {
          parsed.push({
            ...record,
            signature: s.signature,
            time:
              s.blockTime != null ? new Date(Number(s.blockTime) * 1000) : null,
          });
        }
      }
      setRows(parsed);
      setLoadedAddress(addr);
    } catch {
      setError("Could not load history from the RPC");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad) return;
    // deferred so the effect itself doesn't set state synchronously
    const t = setTimeout(() => {
      document
        .getElementById("high-scores")
        ?.scrollIntoView({ behavior: "smooth" });
      void load();
    }, 0);
    return () => clearTimeout(t);
    // run once on mount for a shared link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function shareProfile() {
    if (!loadedAddress) return;
    const url = `${window.location.origin}/?wallet=${loadedAddress}#high-scores`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied", { description: url });
    } catch {
      toast.message("Copy this profile link", { description: url });
    }
  }

  return (
    <div className="pixel-box p-4 sm:p-5">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          className="pixel-input"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="Contributor wallet address"
          spellCheck={false}
          autoCapitalize="none"
        />
        <button
          type="submit"
          disabled={!wallet.trim() || loading}
          className="pixel-btn shrink-0 bg-violet text-white"
        >
          {loading ? "Loading..." : "Load scores"}
        </button>
      </form>

      {error && <p className="mt-3 text-destructive">{error}</p>}

      {rows && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-pixel text-[0.6rem] text-gold">
              QUESTS CLEARED: {rows.length}
            </p>
            {loadedAddress && (
              <button
                type="button"
                onClick={shareProfile}
                className="pixel-btn bg-accent text-foreground"
              >
                🔗 Share profile
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="mt-2 text-muted">
              No BountyBridge payouts yet. Go clear a quest!
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {rows.map((r, i) => (
                <li
                  key={r.signature}
                  className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-border-low pb-2"
                >
                  <span className="text-gold">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span className="min-w-0 flex-1 break-all">
                    {r.repo}#{r.issueNumber}
                  </span>
                  <a
                    href={r.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gold"
                  >
                    PR
                  </a>
                  <a
                    href={getExplorerUrl(`/tx/${r.signature}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gold"
                  >
                    tx
                  </a>
                  {r.time && (
                    <span className="text-muted">
                      {r.time.toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
