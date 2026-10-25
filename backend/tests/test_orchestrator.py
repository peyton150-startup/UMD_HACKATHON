import json

import pytest

from agent.models import DeveloperProfile, Issue, RecommendRequest, RepoContext
from agent.orchestrator import RecommendationError, recommend
from services.github_service import parse_repo

ISSUES = [
    Issue(number=7, title="Fix typo in docs", url="https://github.com/o/r/issues/7"),
    Issue(number=12, title="Add CLI flag", url="https://github.com/o/r/issues/12"),
]
REQ = RecommendRequest(repo="o/r", profile=DeveloperProfile(languages=["python"]))


class FakeGitHub:
    def get_repo_context(self, repo, issues):
        return RepoContext()

    def list_issues(self, repo, labels, limit=15):
        return ISSUES


class ScriptedLLM:
    """Returns canned replies in order, so tests control what the 'model' says."""

    name = "fake"

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = 0

    def complete(self, messages):
        self.calls += 1
        return self.replies.pop(0)


def reply(*numbers):
    return json.dumps(
        {
            "recommendations": [
                {"issue_number": n, "fit_score": 80, "rationale": "fits", "steps": ["do it"]}
                for n in numbers
            ]
        }
    )


def test_valid_reply_is_joined_with_real_issue():
    resp = recommend(REQ, FakeGitHub(), ScriptedLLM(reply(7)))
    assert resp.attempts == 1
    assert resp.recommendations[0].issue.title == "Fix typo in docs"


def test_invented_issue_number_triggers_retry():
    llm = ScriptedLLM(reply(999), reply(12))
    resp = recommend(REQ, FakeGitHub(), llm)
    assert llm.calls == 2
    assert resp.attempts == 2
    assert resp.recommendations[0].issue.number == 12


def test_gives_up_after_two_bad_replies():
    with pytest.raises(RecommendationError):
        recommend(REQ, FakeGitHub(), ScriptedLLM("not json", reply(999)))


@pytest.mark.parametrize(
    "raw",
    ["o/r", "https://github.com/o/r", "https://github.com/o/r.git", "https://github.com/o/r/"],
)
def test_parse_repo(raw):
    assert parse_repo(raw) == "o/r"


def test_list_wrapped_reply_is_accepted_without_retry():
    wrapped = "[" + reply(7) + "]"  # Gemma sometimes wraps the object in a list
    llm = ScriptedLLM(wrapped)
    resp = recommend(REQ, FakeGitHub(), llm)
    assert llm.calls == 1 and resp.recommendations[0].issue.number == 7


def test_bare_list_of_recommendations_is_accepted():
    bare = json.dumps(json.loads(reply(12))["recommendations"])
    resp = recommend(REQ, FakeGitHub(), ScriptedLLM(bare))
    assert resp.recommendations[0].issue.number == 12
