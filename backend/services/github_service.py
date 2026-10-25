"""Read-only access to GitHub issues."""

import os
import re

import httpx

from agent.models import Issue

API = "https://api.github.com"
_REPO_RE = re.compile(r"^(?:https?://github\.com/)?([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


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
    def __init__(self, client: httpx.Client | None = None):
        self.client = client or httpx.Client(base_url=API, headers=_headers(), timeout=15)
        self._cache: dict[tuple, list[Issue]] = {}

    def list_issues(self, repo: str, labels: list[str], limit: int = 15) -> list[Issue]:
        key = (repo, tuple(labels), limit)
        if key in self._cache:
            return self._cache[key]

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
        self._cache[key] = issues
        return issues
