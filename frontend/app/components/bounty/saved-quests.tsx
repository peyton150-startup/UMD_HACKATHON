import { questKey, type SavedQuest } from "../../lib/quest-library";

export function SavedQuests({
  quests,
  active,
  onResume,
  onRemove,
  busy = false,
}: {
  quests: SavedQuest[];
  active: string | null;
  onResume: (quest: SavedQuest) => void;
  onRemove: (key: string) => void;
  busy?: boolean;
}) {
  if (!quests.length) return null;
  return (
    <section className="mt-8 pixel-box p-4 sm:p-5" aria-label="Saved quests">
      <h2 className="font-pixel text-[0.65rem] text-gold">
        SAVED QUESTS · {quests.length}/20
      </h2>
      <p className="mt-2 text-muted">
        Saved in this browser. Resuming restores your checklist; GitHub status
        is checked again before payment.
      </p>
      <ul className="mt-3 divide-y-2 divide-border-low">
        {quests.map((quest) => {
          const key = questKey(quest);
          return (
            <li
              key={key}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all text-neon">
                  {quest.repo}#{quest.rec.issue.number}
                  {active === key ? " · accepted" : ""}
                </p>
                <p>{quest.rec.issue.title}</p>
                <p className="text-muted">
                  Saved {new Date(quest.savedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  className="pixel-btn bg-violet text-white"
                  onClick={() => onResume(quest)}
                >
                  Resume quest
                </button>
                <button
                  type="button"
                  className="underline text-muted hover:text-destructive"
                  aria-label={`Remove ${quest.repo}#${quest.rec.issue.number}`}
                  onClick={() => onRemove(key)}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
