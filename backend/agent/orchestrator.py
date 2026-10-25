"""The control loop: the model suggests, Python decides what is allowed.

1. Fetch real issues from GitHub.
2. Ask the model for JSON recommendations.
3. Parse with Pydantic and reject any issue number GitHub did not return.
4. On failure, retry once with the error fed back; then give up cleanly.
"""

import json

from pydantic import ValidationError

from agent.models import (
    Issue,
    ModelOutput,
    RecommendedIssue,
    RecommendRequest,
    RecommendResponse,
)
from agent.provider import ChatProvider
from services.github_service import GitHubService, parse_repo

MAX_ATTEMPTS = 2

SYSTEM_PROMPT = """You match open-source contributors to GitHub issues.
Only recommend issues from the list you are given, by their exact number.
Reply with JSON only, in this shape:
{"recommendations": [{"issue_number": int, "fit_score": 0-100,
  "rationale": str, "steps": [str, ...], "files_to_look_at": [str, ...]}]}
Return exactly 3 different recommendations (fewer only if fewer issues are listed), best fit first.
Use the full 0-100 range for fit_score so the ranking is meaningful.

Match difficulty to the developer's experience and hours:
- beginner: small, well-scoped work (docs, tests, typing, a contained bug) they can finish
  in the hours given. Never design, architecture, or cross-cutting changes.
- intermediate: a real feature or non-trivial bug touching a few files.
- advanced: the hardest, most impactful issues listed (design, performance, cross-module
  changes). Never pick a trivial docs or typo fix for them.
fit_score is the fit for THIS developer: an easy issue scores low for an advanced developer,
and a hard one scores low for a beginner. Say in the rationale why the difficulty fits."""


class NoIssuesError(RuntimeError):
    pass


class RecommendationError(RuntimeError):
    pass


def build_user_prompt(req: RecommendRequest, issues: list[Issue]) -> str:
    issue_lines = "\n\n".join(
        f"#{i.number}: {i.title}\nlabels: {', '.join(i.labels)}\n{i.body[:400]}" for i in issues
    )
    p = req.profile
    return (
        f"Developer: languages={', '.join(p.languages)}, experience={p.experience}, "
        f"hours available={p.hours_available}\n\nOpen issues:\n\n{issue_lines}"
    )


def normalize_output(data: object) -> object:
    """Accept common near-misses: [{"recommendations": [...]}] or a bare list of recs."""
    if isinstance(data, list):
        if len(data) == 1 and isinstance(data[0], dict) and "recommendations" in data[0]:
            return data[0]
        if all(isinstance(x, dict) and "issue_number" in x for x in data):
            return {"recommendations": data}
    return data


def check_against_issues(output: ModelOutput, issues: list[Issue]) -> list[RecommendedIssue]:
    """Join model output to real issues. Raises if the model invented a number."""
    by_number = {i.number: i for i in issues}
    unknown = [r.issue_number for r in output.recommendations if r.issue_number not in by_number]
    if unknown:
        valid = sorted(by_number)
        raise ValueError(f"issue numbers {unknown} do not exist; choose from {valid}")
    return [
        RecommendedIssue(
            issue=by_number[r.issue_number],
            fit_score=r.fit_score,
            rationale=r.rationale,
            steps=r.steps,
            files_to_look_at=r.files_to_look_at,
        )
        for r in sorted(output.recommendations, key=lambda r: r.fit_score, reverse=True)
    ]


def recommend(req: RecommendRequest, github: GitHubService, llm: ChatProvider) -> RecommendResponse:
    repo = parse_repo(req.repo)
    labels_used = req.labels
    issues = github.list_issues(repo, labels_used)
    if not issues and labels_used:
        # many repos don't use "good first issue"; fall back to any open issue
        labels_used = []
        issues = github.list_issues(repo, labels_used)
    if not issues:
        raise NoIssuesError(f"no open issues in {repo}")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(req, issues)},
    ]
    last_error = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        raw = llm.complete(messages)
        try:
            output = ModelOutput.model_validate(normalize_output(json.loads(raw)))
            recs = check_against_issues(output, issues)
            return RecommendResponse(
                repo=repo,
                provider=llm.name,
                attempts=attempt,
                labels_used=labels_used,
                recommendations=recs,
            )
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = str(exc)
            messages += [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"That reply was invalid: {last_error}. Try again."},
            ]
    raise RecommendationError(f"model output invalid after {MAX_ATTEMPTS} attempts: {last_error}")
