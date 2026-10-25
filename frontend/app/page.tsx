"use client";

import { useState, useSyncExternalStore } from "react";
import { RepoForm } from "./components/bounty/repo-form";
import { QuestCard } from "./components/bounty/quest-card";
import { PayoutPanel } from "./components/bounty/payout-panel";
import { Ledger } from "./components/bounty/ledger";
import { StarterGuide } from "./components/bounty/starter-guide";
import { SavedQuests } from "./components/bounty/saved-quests";
import { useQuestLibrary } from "./lib/hooks/use-quest-library";
import { questKey, type SavedQuest } from "./lib/quest-library";
import { LoadingScreen } from "./components/bounty/loading-screen";
import {
  fetchRecommendations,
  type DeveloperProfile,
  type RecommendResult,
} from "./lib/api";

// ?wallet=<address> opens straight to that wallet's on-chain high scores
const noSubscribe = () => () => {};
function useWalletParam(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("wallet") ?? "",
    () => ""
  );
}

function Level({
  n,
  title,
  children,
  locked,
  id,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  locked?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`mt-10 scroll-mt-20 ${locked ? "opacity-40" : ""}`}
    >
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
  const [lastContributor, setLastContributor] = useState("");
  const { library, dispatch } = useQuestLibrary();
  const accepted = library.saved.find(
    (quest) => questKey(quest) === library.active
  );
  const [searchedRepo, setSearchedRepo] = useState("");
  const walletParam = useWalletParam();

  async function handleSearch(
    repo: string,
    profile: DeveloperProfile,
    labels: string[],
    count: number
  ) {
    setLoading(true);
    setSearchedRepo(repo);
    setError(null);
    setResult(null);
    dispatch({ type: "drop" });
    try {
      setResult(await fetchRecommendations(repo, profile, labels, count));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const data =
    result?.data ??
    (accepted
      ? {
          repo: accepted.repo,
          provider: "saved result",
          attempts: 1,
          labels_used: [],
          recommendations: [accepted.rec],
          repo_context: accepted.context,
        }
      : undefined);
  const quest =
    accepted?.repo === data?.repo
      ? data?.recommendations.find(
          (r) => r.issue.number === accepted?.rec.issue.number
        )
      : undefined;

  function resume(saved: SavedQuest) {
    if (loading) return;
    setResult(null);
    setError(null);
    dispatch({ type: "accept", quest: saved });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      {/* title screen */}
      <div className="text-center">
        <p className="font-pixel text-[0.55rem] text-violet">
          HACKTOBERFEST · GDSC UMD · 2026
        </p>
        <h1 className="mt-4 font-pixel text-2xl leading-snug sm:text-4xl">
          BOUNTY<span className="text-primary">BRIDGE</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
          An open-weight AI finds the open-source issue that fits you. A
          maintainer approves your PR. Solana pays the bounty and keeps the
          score.
        </p>
        <p className="blink mt-4 font-pixel text-[0.6rem] text-gold">
          PRESS START
        </p>
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

      <SavedQuests
        quests={library.saved}
        active={library.active}
        busy={loading}
        onResume={resume}
        onRemove={(key) => dispatch({ type: "remove", key })}
      />

      <Level n={2} title="PICK A QUEST" locked={!data && !loading}>
        {loading && <LoadingScreen repo={searchedRepo} />}
        {!loading && data && (
          <>
            {!result && accepted && (
              <p className="mb-4 border-2 border-gold p-3 text-gold">
                Restored saved quest from{" "}
                {new Date(accepted.savedAt).toLocaleDateString()}. This is a
                historical recommendation; the issue may have changed.
              </p>
            )}
            <p className="mb-4 text-muted">
              {data.recommendations.length} quests from{" "}
              <span className="text-foreground">{data.repo}</span> · model{" "}
              <span className="text-neon">{data.provider}</span> · validated on
              attempt{" "}
              <span className={data.attempts > 1 ? "text-gold" : "text-neon"}>
                {data.attempts}
              </span>
              {data.attempts > 1 &&
                " (the first answer failed validation and was corrected)"}
              {" · "}
              {(data.labels_used ?? []).length > 0 ? (
                <>labels: {data.labels_used.join(", ")}</>
              ) : (
                <span className="text-gold">all open issues</span>
              )}
              {result?.replayed && (
                <span className="ml-2 border-2 border-gold px-1 text-gold">
                  OFFLINE REPLAY of last real result
                </span>
              )}
            </p>
            <StarterGuide
              repo={data.repo}
              context={data.repo_context}
              files={data.recommendations.flatMap(
                (rec) => rec.files_to_look_at
              )}
            />
            <div className="grid gap-5">
              {data.recommendations.map((rec, i) => (
                <QuestCard
                  key={`${data.repo}#${rec.issue.number}`}
                  rec={rec}
                  rank={i + 1}
                  selected={quest?.issue.number === rec.issue.number}
                  onSelect={() =>
                    dispatch({
                      type: "accept",
                      quest: {
                        repo: data.repo,
                        rec,
                        context: data.repo_context,
                        savedAt: new Date().toISOString(),
                      },
                    })
                  }
                  onDrop={() => dispatch({ type: "drop" })}
                  saved={library.saved.some(
                    (q) =>
                      questKey(q) ===
                      `${data.repo.toLowerCase()}#${rec.issue.number}`
                  )}
                  onSave={() => {
                    const key = `${data.repo.toLowerCase()}#${rec.issue.number}`;
                    dispatch(
                      library.saved.some((q) => questKey(q) === key)
                        ? { type: "remove", key }
                        : {
                            type: "save",
                            quest: {
                              repo: data.repo,
                              rec,
                              context: data.repo_context,
                              savedAt: new Date().toISOString(),
                            },
                          }
                    );
                  }}
                  completedSteps={
                    library.progress[
                      `${data.repo.toLowerCase()}#${rec.issue.number}`
                    ] ?? []
                  }
                  onStep={(step, checked) =>
                    dispatch({
                      type: "step",
                      key: `${data.repo.toLowerCase()}#${rec.issue.number}`,
                      step,
                      checked,
                    })
                  }
                  repo={data.repo}
                  context={data.repo_context}
                />
              ))}
            </div>
          </>
        )}
      </Level>

      <Level n={3} title="APPROVE & PAY BOUNTY" locked={!quest}>
        {data && quest && (
          // key: switching quests starts a fresh form (no carried-over approval or signature)
          <PayoutPanel
            key={`${data.repo}#${quest.issue.number}`}
            repo={data.repo}
            quest={quest}
            onPaid={setLastContributor}
          />
        )}
      </Level>

      <Level n={4} title="HIGH SCORES (ON-CHAIN)" id="high-scores">
        {/* key remounts the ledger with the newly paid contributor prefilled;
            a ?wallet= link loads that wallet's scores right away */}
        <Ledger
          key={lastContributor || walletParam}
          initialAddress={lastContributor || walletParam}
          autoLoad={!lastContributor && walletParam !== ""}
        />
      </Level>
    </main>
  );
}
