"""Data shapes shared by the API, the agent, and the GitHub service."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class DeveloperProfile(BaseModel):
    languages: list[str] = Field(min_length=1, examples=[["python", "typescript"]])
    experience: Literal["beginner", "intermediate", "advanced"] = "beginner"
    hours_available: int = Field(default=4, ge=1, le=80)


class RecommendRequest(BaseModel):
    repo: str = Field(examples=["owner/name or https://github.com/owner/name"])
    profile: DeveloperProfile
    labels: list[str] = Field(default_factory=lambda: ["good first issue"])


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

    recommendations: list[Recommendation] = Field(min_length=1, max_length=3)

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


class RecommendResponse(BaseModel):
    repo: str
    provider: str
    attempts: int
    recommendations: list[RecommendedIssue]
