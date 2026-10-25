// Types mirror backend/agent/models.py.

export type Experience = "beginner" | "intermediate" | "advanced";

export type DeveloperProfile = {
  languages: string[];
  experience: Experience;
  hours_available: number;
};

export type Issue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  url: string;
};

export type RecommendedIssue = {
  issue: Issue;
  fit_score: number;
  rationale: string;
  steps: string[];
  files_to_look_at: string[];
};

export type RecommendResponse = {
  repo: string;
  provider: string;
  attempts: number;
  labels_used: string[];
  recommendations: RecommendedIssue[];
};

export type PrVerification = {
  ok: boolean;
  reason: string;
  repo_matches: boolean;
  merged: boolean;
  mentions_issue: boolean;
  title: string;
  author: string;
  merged_at: string | null;
};

export type RecommendResult = {
  data: RecommendResponse;
  /** true when the backend was unreachable and we replayed the last real result */
  replayed: boolean;
};

// Same-origin by default: on Vercel /api/* is routed to the backend service;
// in `next dev`, next.config.ts proxies /api/* to the local uvicorn on :8000.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const CACHE_PREFIX = "bountybridge:last:";
// Backend worst case is 2 attempts x provider timeout; don't hang the demo longer than this.
const REQUEST_TIMEOUT_MS = 90_000;

/** One cache entry per exact request, so a different profile never replays someone else's result. */
function cacheKey(repo: string, profile: DeveloperProfile, labels: string[]) {
  return (
    CACHE_PREFIX +
    JSON.stringify([
      repo.trim().toLowerCase(),
      [...profile.languages].map((l) => l.toLowerCase()).sort(),
      profile.experience,
      profile.hours_available,
      [...labels].map((l) => l.toLowerCase()).sort(),
    ])
  );
}

function readCache(key: string): RecommendResponse | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as RecommendResponse) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: RecommendResponse) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage unavailable; replay just won't work
  }
}

/**
 * Ask the backend for recommendations. If the backend or model provider is
 * down (network error or 5xx), fall back to the last real result for this repo
 * so a live demo can keep going. 4xx errors are user errors and are shown as-is.
 */
export async function fetchRecommendations(
  repo: string,
  profile: DeveloperProfile,
  labels: string[]
): Promise<RecommendResult> {
  const key = cacheKey(repo, profile, labels);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, profile, labels }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const cached = readCache(key);
    if (cached) return { data: cached, replayed: true };
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new Error("The model took too long. Try again.");
    }
    throw new Error(
      `Backend unreachable at ${API_URL}. Is the backend running?`
    );
  }

  if (!res.ok) {
    const detail = await res
      .json()
      .then((body) => (typeof body.detail === "string" ? body.detail : null))
      .catch(() => null);
    if (res.status >= 500) {
      const cached = readCache(key);
      if (cached) return { data: cached, replayed: true };
    }
    throw new Error(detail ?? `Backend error ${res.status}`);
  }

  const data = (await res.json()) as RecommendResponse;
  writeCache(key, data);
  return { data, replayed: false };
}

/** Ask the backend (which asks GitHub) whether a PR is merged and belongs to the repo. */
export async function verifyPr(
  repo: string,
  issueNumber: number,
  prUrl: string
): Promise<PrVerification> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/verify-pr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo,
        issue_number: issueNumber,
        pr_url: prUrl.trim(),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(
      `Backend unreachable at ${API_URL}. Is the backend running?`
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Backend error ${res.status}`
    );
  }
  return (await res.json()) as PrVerification;
}

export type RepoSuggestion = {
  full_name: string;
  description: string;
  language: string | null;
  stars: number;
  url: string;
  pushed_at: string;
};

export type DiscoverResponse = { query: string; repos: RepoSuggestion[] };

export type RepoScope = { owner: string; name?: string };

/**
 * Read an owner (and optional partial repo name) from what's typed in the repo box:
 * "microsoft", "microsoft/", "microsoft/auto", "https://github.com/microsoft/..." -> scope.
 */
export function parseRepoScope(input: string): RepoScope | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/, "");
  if (!cleaned) return null;
  const [owner, name] = cleaned.split("/").map((part) => part.trim());
  if (!owner) return null;
  return name ? { owner, name } : { owner };
}

/**
 * Repos in these languages with 3+ open good-first-issues. With a scope, only that
 * owner's repos (any topic); without one, active Hacktoberfest-tagged repos.
 */
export async function discoverRepos(
  languages: string[],
  scope: RepoScope | null = null
): Promise<DiscoverResponse> {
  const params = new URLSearchParams({ languages: languages.join(",") });
  if (scope?.owner) params.set("owner", scope.owner);
  if (scope?.name) params.set("name", scope.name);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/discover?${params}`, {
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(
      `Backend unreachable at ${API_URL}. Is the backend running?`
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Backend error ${res.status}`
    );
  }
  return (await res.json()) as DiscoverResponse;
}
