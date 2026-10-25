"use client";

import { useState } from "react";
import { RepoForm } from "./components/bounty/repo-form";
import { QuestCard } from "./components/bounty/quest-card";
import { PayoutPanel } from "./components/bounty/payout-panel";
import { Ledger } from "./components/bounty/ledger";
import {
  fetchRecommendations,
  type DeveloperProfile,
  type RecommendResult,
} from "./lib/api";

function Level({
  n,
  title,
  children,
  locked,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <section className={`mt-10 ${locked ? "opacity-40" : ""}`}>
      <h2 className="mb-4 font-pixel text-[0.7rem] leading-relaxed sm:text-xs">
        <span className="text-primary">LEVEL {n}</span>
        <span className="text-muted"> · </span>
        {title}
      </h2>
      {locked ? (
        <div className="border-3 border-dashed border-border-low p-4 text-muted">
          🔒 Locked. Clear the level above first.
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastContributor, setLastContributor] = useState("");

  async function handleSearch(repo: string, profile: DeveloperProfile, labels: string[]) {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);
    try {
      setResult(await fetchRecommendations(repo, profile, labels));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const data = result?.data;
  const quest = data?.recommendations.find((r) => r.issue.number === selected);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      {/* title screen */}
      <div className="text-center">
        <p className="font-pixel text-[0.55rem] text-violet">HACKTOBERFEST · GDSC UMD · 2026</p>
        <h1 className="mt-4 font-pixel text-2xl leading-snug sm:text-4xl">
          BOUNTY<span className="text-primary">BRIDGE</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
          An open-weight AI finds the open-source issue that fits you. A maintainer
          approves your PR. Solana pays the bounty and keeps the score.
        </p>
        <p className="blink mt-4 font-pixel text-[0.6rem] text-gold">PRESS START</p>
      </div>

      <Level n={1} title="CHOOSE YOUR REPO">
        <div className="pixel-box p-4 sm:p-5">
          <RepoForm loading={loading} onSubmit={handleSearch} />
          {error && (
            <p className="mt-4 text-destructive" role="alert">
              GAME OVER: {error}
            </p>
          )}
        </div>
      </Level>

      <Level n={2} title="PICK A QUEST" locked={!data}>
        {data && (
          <>
            <p className="mb-4 text-muted">
              {data.recommendations.length} quests from{" "}
              <span className="text-foreground">{data.repo}</span> · model{" "}
              <span className="text-neon">{data.provider}</span> · validated on attempt{" "}
              <span className={data.attempts > 1 ? "text-gold" : "text-neon"}>{data.attempts}</span>
              {data.attempts > 1 && " (first answer cited an issue that doesn't exist and was rejected)"}
              {result?.replayed && (
                <span className="ml-2 border-2 border-gold px-1 text-gold">
                  OFFLINE REPLAY of last real result
                </span>
              )}
            </p>
            <div className="grid gap-5">
              {data.recommendations.map((rec, i) => (
                <QuestCard
                  key={rec.issue.number}
                  rec={rec}
                  rank={i + 1}
                  selected={selected === rec.issue.number}
                  onSelect={() => setSelected(rec.issue.number)}
                />
              ))}
            </div>
          </>
        )}
      </Level>

      <Level n={3} title="APPROVE & PAY BOUNTY" locked={!quest}>
        {data && quest && (
          <PayoutPanel repo={data.repo} quest={quest} onPaid={setLastContributor} />
        )}
      </Level>

      <Level n={4} title="HIGH SCORES (ON-CHAIN)">
        {/* key remounts the ledger with the newly paid contributor prefilled */}
        <Ledger key={lastContributor} initialAddress={lastContributor} />
      </Level>
    </main>
  );
}
