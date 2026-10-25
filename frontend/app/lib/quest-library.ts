import type { RecommendedIssue, RepoContext } from "./api";

export type SavedQuest = {
  repo: string;
  rec: RecommendedIssue;
  context?: RepoContext;
  savedAt: string;
};
export type QuestLibrary = {
  version: 1;
  saved: SavedQuest[];
  active: string | null;
  progress: Record<string, string[]>;
};
export type LibraryAction =
  | { type: "save" | "accept"; quest: SavedQuest }
  | { type: "remove"; key: string }
  | { type: "drop" }
  | { type: "step"; key: string; step: string; checked: boolean };

export function emptyLibrary(): QuestLibrary {
  return { version: 1, saved: [], active: null, progress: {} };
}

export function questKey(quest: Pick<SavedQuest, "repo" | "rec">): string {
  return `${quest.repo.toLowerCase()}#${quest.rec.issue.number}`;
}

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function isSavedQuest(value: unknown): value is SavedQuest {
  if (!value || typeof value !== "object") return false;
  const q = value as SavedQuest;
  const r = q.rec;
  return (
    typeof q.repo === "string" &&
    /^[\w.-]+\/[\w.-]+$/.test(q.repo) &&
    typeof q.savedAt === "string" &&
    Number.isFinite(Date.parse(q.savedAt)) &&
    !!r?.issue &&
    Number.isSafeInteger(r.issue.number) &&
    r.issue.number > 0 &&
    typeof r.issue.title === "string" &&
    typeof r.issue.body === "string" &&
    strings(r.issue.labels) &&
    typeof r.issue.url === "string" &&
    r.issue.url.toLowerCase() ===
      `https://github.com/${q.repo.toLowerCase()}/issues/${r.issue.number}` &&
    Number.isFinite(r.fit_score) &&
    r.fit_score >= 0 &&
    r.fit_score <= 100 &&
    typeof r.rationale === "string" &&
    strings(r.steps) &&
    r.steps.length > 0 &&
    strings(r.files_to_look_at) &&
    (q.context === undefined || isRepoContext(q.context))
  );
}

function isRepoContext(value: unknown): value is RepoContext {
  if (!value || typeof value !== "object") return false;
  const c = value as RepoContext;
  return (
    typeof c.available === "boolean" &&
    typeof c.revision === "string" &&
    strings(c.files) &&
    typeof c.truncated === "boolean" &&
    typeof c.warning === "string" &&
    [c.guides, c.code_samples].every(
      (docs) =>
        Array.isArray(docs) &&
        docs.every(
          (d) =>
            d &&
            typeof d.path === "string" &&
            typeof d.url === "string" &&
            typeof d.excerpt === "string"
        )
    )
  );
}

export function parseLibrary(raw: string | null): QuestLibrary {
  try {
    const data = JSON.parse(raw ?? "null");
    if (
      data?.version !== 1 ||
      !Array.isArray(data.saved) ||
      !data.saved.every(isSavedQuest) ||
      !data.progress ||
      typeof data.progress !== "object" ||
      Array.isArray(data.progress)
    )
      return emptyLibrary();
    const saved: SavedQuest[] = data.saved.slice(0, 20);
    const progress = Object.fromEntries(
      Object.entries(data.progress)
        .filter(
          ([key, steps]) => /^[\w.-]+\/[\w.-]+#\d+$/.test(key) && strings(steps)
        )
        .slice(-100)
    );
    return {
      version: 1,
      saved,
      progress: progress as Record<string, string[]>,
      active: saved.some((q) => questKey(q) === data.active)
        ? data.active
        : null,
    };
  } catch {
    return emptyLibrary();
  }
}

export function updateLibrary(
  state: QuestLibrary,
  action: LibraryAction
): QuestLibrary {
  if (action.type === "drop") return { ...state, active: null };
  if (action.type === "step") {
    const steps = new Set(state.progress[action.key] ?? []);
    if (action.checked) steps.add(action.step);
    else steps.delete(action.step);
    const entries = Object.entries(state.progress).filter(
      ([key]) => key !== action.key
    );
    entries.push([action.key, [...steps]]);
    return { ...state, progress: Object.fromEntries(entries.slice(-100)) };
  }
  if (action.type === "remove")
    return {
      ...state,
      saved: state.saved.filter((q) => questKey(q) !== action.key),
      active: state.active === action.key ? null : state.active,
    };
  const key = questKey(action.quest);
  let saved = [action.quest, ...state.saved.filter((q) => questKey(q) !== key)];
  // A bookmark should never evict the currently accepted quest.
  if (saved.length > 20 && state.active && action.type !== "accept") {
    const active = saved.find((q) => questKey(q) === state.active);
    saved = saved.slice(0, 20);
    if (active && !saved.some((q) => questKey(q) === state.active))
      saved = [...saved.slice(0, 19), active];
  } else saved = saved.slice(0, 20);
  return {
    ...state,
    saved,
    active: action.type === "accept" ? key : state.active,
  };
}
