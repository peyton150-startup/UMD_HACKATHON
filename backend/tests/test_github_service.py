import httpx
import pytest

from agent.models import DeveloperProfile, RecommendRequest
from agent.orchestrator import recommend
from services.github_service import CACHE_TTL_S, GitHubService

ISSUE = {"number": 5, "title": "Fix bug", "body": "", "labels": [], "html_url": "https://x/5"}


def service(handler, clock=lambda: 0.0):
    client = httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(handler))
    return GitHubService(client=client, clock=clock)


# --- issue cache -----------------------------------------------------------


def test_issue_cache_expires():
    calls = []
    now = [0.0]

    def handler(request):
        calls.append(request.url)
        return httpx.Response(200, json=[ISSUE])

    gh = service(handler, clock=lambda: now[0])
    gh.list_issues("o/r", [])
    gh.list_issues("o/r", [])
    assert len(calls) == 1  # served from cache
    now[0] = CACHE_TTL_S + 1
    gh.list_issues("o/r", [])
    assert len(calls) == 2  # expired, refetched


# --- label fallback ---------------------------------------------------------


class OneReplyLLM:
    name = "fake"

    def complete(self, messages):
        return '{"recommendations": [{"issue_number": 5, "fit_score": 70, "rationale": "ok", "steps": ["a"]}]}'


def test_falls_back_to_all_open_issues_when_label_matches_nothing():
    def handler(request):
        has_label = "labels" in request.url.params
        return httpx.Response(200, json=[] if has_label else [ISSUE])

    req = RecommendRequest(repo="o/r", profile=DeveloperProfile(languages=["python"]))
    resp = recommend(req, service(handler), OneReplyLLM())
    assert resp.labels_used == []
    assert resp.recommendations[0].issue.number == 5


# --- PR verification --------------------------------------------------------


def pr_handler(pr: dict | None):
    def handler(request):
        if pr is None:
            return httpx.Response(404, json={"message": "Not Found"})
        return httpx.Response(200, json=pr)

    return handler


MERGED = {
    "merged": True,
    "title": "Fix bug",
    "body": "Closes #5",
    "user": {"login": "terp"},
    "merged_at": "2026-10-20T12:00:00Z",
}


def test_merged_pr_in_same_repo_is_ok():
    v = service(pr_handler(MERGED)).verify_pull_request(
        "o/r", 5, "https://github.com/o/r/pull/9"
    )
    assert v.ok and v.merged and v.mentions_issue
    assert v.author == "terp"


def test_unmerged_pr_is_rejected():
    v = service(pr_handler({**MERGED, "merged": False, "merged_at": None})).verify_pull_request(
        "o/r", 5, "https://github.com/o/r/pull/9"
    )
    assert not v.ok
    assert "not merged" in v.reason


def test_pr_from_another_repo_is_rejected_without_calling_github():
    def handler(request):
        raise AssertionError("should not call GitHub")

    v = service(handler).verify_pull_request("o/r", 5, "https://github.com/other/r/pull/9")
    assert not v.ok and not v.repo_matches


def test_missing_pr_is_rejected():
    v = service(pr_handler(None)).verify_pull_request("o/r", 5, "https://github.com/o/r/pull/9")
    assert not v.ok and "not found" in v.reason


def test_bad_pr_url_raises():
    with pytest.raises(ValueError):
        service(pr_handler(MERGED)).verify_pull_request("o/r", 5, "https://github.com/o/r/issues/9")
