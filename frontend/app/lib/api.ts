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
  recommendations: RecommendedIssue[];
};

export type RecommendResult = {
  data: RecommendResponse;
  /** true when the backend was unreachable and we replayed the last real result */
  replayed: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CACHE_PREFIX = "bountybridge:last:";
// Backend worst case is 2 attempts x provider timeout; don't hang the demo longer than this.
const REQUEST_TIMEOUT_MS = 90_000;

function cacheKey(repo: string) {
  return CACHE_PREFIX + repo.trim().toLowerCase();
}

function readCache(repo: string): RecommendResponse | null {
  try {
    const raw = localStorage.getItem(cacheKey(repo));
    return raw ? (JSON.parse(raw) as RecommendResponse) : null;
  } catch {
    return null;
  }
}

function writeCache(repo: string, data: RecommendResponse) {
  try {
    localStorage.setItem(cacheKey(repo), JSON.stringify(data));
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
  let res: Response;
  try {
    res = await fetch(`${API_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, profile, labels }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const cached = readCache(repo);
    if (cached) return { data: cached, replayed: true };
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new Error("The model took too long. Try again.");
    }
    throw new Error(`Backend unreachable at ${API_URL}. Is uvicorn running?`);
  }

  if (!res.ok) {
    const detail = await res
      .json()
      .then((body) => (typeof body.detail === "string" ? body.detail : null))
      .catch(() => null);
    if (res.status >= 500) {
      const cached = readCache(repo);
      if (cached) return { data: cached, replayed: true };
    }
    throw new Error(detail ?? `Backend error ${res.status}`);
  }

  const data = (await res.json()) as RecommendResponse;
  writeCache(repo, data);
  return { data, replayed: false };
}
