"""The quest-count slider: the request asks for 3-9 quests."""

import json

import pytest
from pydantic import ValidationError

from agent.models import DeveloperProfile, Issue, RecommendRequest, RepoContext
from agent.orchestrator import build_user_prompt, recommend

ISSUES = [
    Issue(number=n, title=f"Issue {n}", url=f"https://github.com/o/r/issues/{n}")
    for n in range(1, 13)
]


class FakeGitHub:
    def __init__(self):
        self.limits = []

    def get_repo_context(self, repo, issues):
        return RepoContext()

    def list_issues(self, repo, labels, limit=10):
        self.limits.append(limit)
        return ISSUES


class OneReply:
    name = "fake"

    def __init__(self, numbers):
        self.reply = json.dumps(
            {
                "recommendations": [
                    {"issue_number": n, "fit_score": 90 - n, "rationale": "fits", "steps": ["do it"]}
                    for n in numbers
                ]
            }
        )

    def complete(self, messages):
        return self.reply


def req(count=None):
    extra = {} if count is None else {"count": count}
    return RecommendRequest(repo="o/r", profile=DeveloperProfile(languages=["python"]), **extra)


def test_default_count_is_three():
    assert req().count == 3


@pytest.mark.parametrize("bad", [2, 10])
def test_count_outside_3_to_9_is_rejected(bad):
    with pytest.raises(ValidationError):
        req(bad)


def test_prompt_asks_for_the_requested_count():
    assert "Return exactly 7 unique" in build_user_prompt(req(7), ISSUES)


def test_nine_quests_come_back_and_more_issues_are_fetched():
    gh = FakeGitHub()
    out = recommend(req(9), gh, OneReply(range(1, 10)))
    assert len(out.recommendations) == 9
    assert gh.limits == [18]


def test_extra_quests_from_the_model_are_trimmed_to_the_best():
    out = recommend(req(3), FakeGitHub(), OneReply(range(1, 7)))
    # fit_score is 90 - n, so issues 1-3 are the best fits
    assert [r.issue.number for r in out.recommendations] == [1, 2, 3]
