"""Read-only access to GitHub issues and pull requests."""

import os
import re
import time
from collections.abc import Callable

import httpx

from datetime import UTC, datetime, timedelta

from agent.models import DiscoverResponse, Issue, PrVerification, RepoSuggestion

API = "https://api.github.com"
CACHE_TTL_S = 300  # closed issues drop out of recommendations within 5 minutes
DISCOVER_TTL_S = 900  # GitHub search allows only 10-30 requests/min, so cache longer
_LANG_RE = re.compile(r"^[\w#+.\- ]{1,30}$")
_REPO_RE = re.compile(r"^(?:https?://github\.com/)?([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")
_PR_RE = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+)/pull/(\d+)/?$")


class GitHubError(RuntimeError):
    pass


def parse_repo(repo: str) -> str:
    """Accept 'owner/name' or a github.com URL; return 'owner/name'."""
    match = _REPO_RE.match(repo.strip())
    if not match:
        raise ValueError(f"not a GitHub repo: {repo!r}")
    return f"{match.group(1)}/{match.group(2)}"


def _headers() -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    if token := os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {token}"
    return headers


class GitHubService:
    def __init__(
        self,
        client: httpx.Client | None = None,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.client = client or httpx.Client(base_url=API, headers=_headers(), timeout=15)
        self.clock = clock
        self._cache: dict[tuple, tuple[float, list[Issue]]] = {}
        self._discover_cache: dict[tuple, tuple[float, DiscoverResponse]] = {}

    def list_issues(self, repo: str, labels: list[str], limit: int = 10) -> list[Issue]:
        key = (repo, tuple(labels), limit)
        cached = self._cache.get(key)
        if cached and self.clock() - cached[0] < CACHE_TTL_S:
            return cached[1]

        params = {"state": "open", "per_page": limit}
        if labels:
            params["labels"] = ",".join(labels)
        resp = self.client.get(f"/repos/{repo}/issues", params=params)
        if resp.status_code != 200:
            raise GitHubError(f"GitHub {resp.status_code}: {resp.text[:200]}")

        issues = [
            Issue(
                number=item["number"],
                title=item["title"],
                body=(item.get("body") or "")[:1500],
                labels=[label["name"] for label in item.get("labels", [])],
                url=item["html_url"],
            )
            for item in resp.json()
            if "pull_request" not in item  # the issues API also returns PRs
        ]
        self._cache[key] = (self.clock(), issues)
        return issues

    def discover_repos(self, languages: list[str], limit: int = 6) -> DiscoverResponse:
        """Active Hacktoberfest repos in these languages with 3+ open good-first-issues."""
        langs = sorted({lang.strip().lower() for lang in languages if lang.strip()})[:5]
        if not langs or not all(_LANG_RE.match(lang) for lang in langs):
            raise ValueError("give 1-5 language names, e.g. python, typescript")

        key = (tuple(langs), limit)
        cached = self._discover_cache.get(key)
        if cached and self.clock() - cached[0] < DISCOVER_TTL_S:
            return cached[1]

        since = (datetime.now(UTC) - timedelta(days=30)).date().isoformat()
        # repeated language: qualifiers are OR'd by GitHub search
        query = " ".join(
            [
                "topic:hacktoberfest",
                "good-first-issues:>=3",
                "archived:false",
                "stars:50..20000",  # skip toy repos and giant ones newcomers get lost in
                f"pushed:>={since}",
                *(f'language:"{lang}"' for lang in langs),
            ]
        )
        resp = self.client.get(
            "/search/repositories",
            params={"q": query, "sort": "stars", "order": "desc", "per_page": limit},
        )
        if resp.status_code == 403 or resp.status_code == 429:
            raise GitHubError("GitHub search rate limit hit; wait a minute or set GITHUB_TOKEN")
        if resp.status_code != 200:
            raise GitHubError(f"GitHub {resp.status_code}: {resp.text[:200]}")

        result = DiscoverResponse(
            query=query,
            repos=[
                RepoSuggestion(
                    full_name=item["full_name"],
                    description=(item.get("description") or "")[:160],
                    language=item.get("language"),
                    stars=item["stargazers_count"],
                    url=item["html_url"],
                    pushed_at=item["pushed_at"],
                )
                for item in resp.json().get("items", [])
            ],
        )
        self._discover_cache[key] = (self.clock(), result)
        return result

    def verify_pull_request(self, repo: str, issue_number: int, pr_url: str) -> PrVerification:
        """Check that the PR exists, is in `repo`, and is merged. Never cached."""
        match = _PR_RE.match(pr_url.strip())
        if not match:
            raise ValueError("PR link must look like https://github.com/owner/repo/pull/123")
        pr_repo, pr_number = f"{match.group(1)}/{match.group(2)}", int(match.group(3))

        if pr_repo.lower() != repo.lower():
            return PrVerification(
                ok=False, repo_matches=False, reason=f"PR is in {pr_repo}, not {repo}"
            )

        resp = self.client.get(f"/repos/{pr_repo}/pulls/{pr_number}")
        if resp.status_code == 404:
            return PrVerification(ok=False, repo_matches=True, reason="PR not found on GitHub")
        if resp.status_code != 200:
            raise GitHubError(f"GitHub {resp.status_code}: {resp.text[:200]}")

        pr = resp.json()
        merged = bool(pr.get("merged"))
        text = f"{pr.get('title') or ''}\n{pr.get('body') or ''}"
        mentions = bool(
            re.search(rf"#{issue_number}\b", text) or f"/issues/{issue_number}" in text
        )
        return PrVerification(
            ok=merged,
            reason="Merged PR in this repo" if merged else "PR is not merged yet",
            repo_matches=True,
            merged=merged,
            mentions_issue=mentions,
            title=pr.get("title") or "",
            author=(pr.get("user") or {}).get("login", ""),
            merged_at=pr.get("merged_at"),
        )
