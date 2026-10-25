"use client";

import type { RecommendedIssue, RepoContext } from "../../lib/api";
import { fileUrl } from "./starter-guide";

type Props = {
  rec: RecommendedIssue;
  rank: number;
  selected: boolean;
  onSelect: () => void;
  onDrop: () => void;
  saved: boolean;
  onSave: () => void;
  completedSteps: string[];
  onStep: (step: string, checked: boolean) => void;
  repo?: string;
  context?: RepoContext;
};

const SEGMENTS = 10;

export function QuestCard({
  rec,
  rank,
  selected,
  onSelect,
  onDrop,
  saved,
  onSave,
  completedSteps,
  onStep,
  repo,
  context,
}: Props) {
  const filled = Math.round((rec.fit_score / 100) * SEGMENTS);
  const completed = rec.steps.filter((step) =>
    completedSteps.includes(step)
  ).length;

  return (
    <article
      className={`pixel-box p-4 ${selected ? "!border-gold" : ""}`}
      aria-current={selected}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-pixel text-[0.55rem] text-violet">
            QUEST {rank} · ISSUE #{rec.issue.number}
          </p>
          <h3 className="mt-2 text-xl leading-tight">
            <a
              href={rec.issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold hover:underline"
            >
              {rec.issue.title}
            </a>
          </h3>
        </div>
        <span
          className="shrink-0 border-2 border-neon px-2 text-neon"
          title="This issue number was checked against the issues GitHub returned"
        >
          ✓ verified on GitHub
        </span>
      </div>

      <div
        className="mt-3 flex items-center gap-3"
        aria-label={`Fit score ${rec.fit_score} of 100`}
      >
        <span className="font-pixel text-[0.5rem] text-muted">FIT</span>
        <div className="flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 ${i < filled ? "bg-gold" : "bg-border-low"}`}
            />
          ))}
        </div>
        <span className="text-gold">{rec.fit_score}</span>
      </div>

      <p className="mt-3">{rec.rationale}</p>

      <details className="mt-3" open={selected}>
        <summary className="cursor-pointer text-muted hover:text-foreground">
          Contribution checklist ({completed}/{rec.steps.length} complete)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-6">
          {rec.steps.map((step, i) => (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={completedSteps.includes(step)}
                  onChange={(e) => onStep(step, e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--gold)]"
                />
                <span
                  className={
                    completedSteps.includes(step)
                      ? "text-muted line-through"
                      : ""
                  }
                >
                  {step}
                </span>
              </label>
            </li>
          ))}
        </ol>
        {rec.files_to_look_at.length > 0 && (
          <p className="mt-2 text-muted">
            Files to check:{" "}
            {rec.files_to_look_at.map((f) => {
              const url = repo ? fileUrl(repo, context, f) : null;
              return url ? (
                <a
                  key={f}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mr-2 break-all underline text-neon"
                >
                  {f}
                </a>
              ) : (
                <code key={f} className="mr-2 break-all text-foreground">
                  {f} (unverified)
                </code>
              );
            })}
          </p>
        )}
      </details>

      <button
        type="button"
        onClick={onSave}
        aria-pressed={saved}
        className="mt-4 mr-4 border-2 border-gold px-3 py-2 text-gold hover:bg-accent"
      >
        {saved ? "★ Saved · remove" : "☆ Save quest"}
      </button>

      {selected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="font-pixel text-[0.6rem] text-gold">
            ★ QUEST ACCEPTED
          </span>
          <button
            onClick={onDrop}
            className="pixel-btn bg-accent text-foreground"
          >
            ✕ Drop quest
          </button>
        </div>
      ) : (
        <button
          onClick={onSelect}
          className="pixel-btn mt-4 bg-violet text-white"
        >
          Accept quest
        </button>
      )}
    </article>
  );
}
