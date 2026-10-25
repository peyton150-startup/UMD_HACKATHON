"""Data shapes shared by the API, the agent, and the GitHub service."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

MIN_RECS = 3
MAX_RECS = 9


class DeveloperProfile(BaseModel):
    languages: list[str] = Field(min_length=1, examples=[["python", "typescript"]])
    experience: Literal["beginner", "intermediate", "advanced"] = "beginner"
    hours_available: int = Field(default=4, ge=1, le=80)


class RecommendRequest(BaseModel):
    repo: str = Field(examples=["owner/name or https://github.com/owner/name"])
    profile: DeveloperProfile
    labels: list[str] = Field(default_factory=lambda: ["good first issue"])
    # how many quests to return; the UI slider sends 3-9
    count: int = Field(default=3, ge=MIN_RECS, le=MAX_RECS)


class Issue(BaseModel):
    number: int
    title: str
    body: str = ""
    labels: list[str] = []
    url: str


class Recommendation(BaseModel):
    issue_number: int
    fit_score: int = Field(ge=0, le=100)
    rationale: str = Field(min_length=1)
    steps: list[str] = Field(min_length=1)
    files_to_look_at: list[str] = []


class ModelOutput(BaseModel):
    """What we ask the LLM to return. Parsed before we trust anything in it."""

    recommendations: list[Recommendation] = Field(min_length=1, max_length=MAX_RECS)

    @field_validator("recommendations")
    @classmethod
    def unique_issues(cls, recs: list[Recommendation]) -> list[Recommendation]:
        numbers = [r.issue_number for r in recs]
        if len(numbers) != len(set(numbers)):
            raise ValueError("each issue may be recommended only once")
        return recs


class RecommendedIssue(BaseModel):
    """A validated recommendation joined with the real GitHub issue."""

    issue: Issue
    fit_score: int
    rationale: str
    steps: list[str]
    files_to_look_at: list[str]


class RepoDocument(BaseModel):
    path: str
    url: str
    excerpt: str


class RepoContext(BaseModel):
    available: bool = False
    revision: str = ""
    files: list[str] = Field(default_factory=list)
    guides: list[RepoDocument] = Field(default_factory=list)
    code_samples: list[RepoDocument] = Field(default_factory=list)
    truncated: bool = False
    warning: str = ""


class RecommendResponse(BaseModel):
    repo: str
    provider: str
    attempts: int
    # labels actually used to pick issues; [] means no labeled issues, so all open issues
    labels_used: list[str] = []
    recommendations: list[RecommendedIssue]
    repo_context: RepoContext = Field(default_factory=RepoContext)


class RepoSuggestion(BaseModel):
    full_name: str
    description: str = ""
    language: str | None = None
    stars: int
    url: str
    pushed_at: str


class DiscoverResponse(BaseModel):
    query: str  # the exact GitHub search, shown so the filtering is transparent
    repos: list[RepoSuggestion]


class VerifyPrRequest(BaseModel):
    repo: str
    issue_number: int
    pr_url: str


class PrVerification(BaseModel):
    """GitHub's answer about a PR. `ok` gates the payout button."""

    ok: bool
    reason: str
    repo_matches: bool
    merged: bool = False
    mentions_issue: bool = False  # informational: PR title/body references the issue
    title: str = ""
    author: str = ""
    merged_at: str | None = None
