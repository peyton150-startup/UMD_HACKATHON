"""FastAPI entry point.

Local:  cd backend && uvicorn main:app --reload   (Next dev proxies /api/* here)
Vercel: the "backend" service in vercel.json; the public rewrite sends /api/* here.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# keys live in the project-root .env (UMD_HACKATHON/.env) locally; on Vercel they are
# project environment variables and this file simply doesn't exist
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import APIRouter, FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from agent.models import (  # noqa: E402
    DiscoverResponse,
    PrVerification,
    RecommendRequest,
    RecommendResponse,
    VerifyPrRequest,
)
from agent.orchestrator import NoIssuesError, RecommendationError, recommend  # noqa: E402
from agent.provider import ProviderError, build_provider_from_env  # noqa: E402
from services.github_service import GitHubError, GitHubService, parse_repo  # noqa: E402

app = FastAPI(title="BountyBridge Lite API")

# Only needed when the browser calls the API on a different origin. On Vercel the
# frontend and API share one domain, so this list rarely matters.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

github = GitHubService()
router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"ok": True}


@router.post("/recommend", response_model=RecommendResponse)
def recommend_endpoint(req: RecommendRequest) -> RecommendResponse:
    try:
        return recommend(req, github, build_provider_from_env())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except NoIssuesError as exc:
        raise HTTPException(404, str(exc)) from exc
    except (GitHubError, ProviderError, RecommendationError) as exc:
        raise HTTPException(502, str(exc)) from exc


@router.get("/discover", response_model=DiscoverResponse)
def discover_endpoint(languages: str) -> DiscoverResponse:
    """Suggest repos for a comma-separated language list, e.g. ?languages=python,go"""
    try:
        return github.discover_repos(languages.split(","))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except GitHubError as exc:
        raise HTTPException(502, str(exc)) from exc


@router.post("/verify-pr", response_model=PrVerification)
def verify_pr_endpoint(req: VerifyPrRequest) -> PrVerification:
    """GitHub, not the model, decides whether a contribution is payable."""
    try:
        return github.verify_pull_request(parse_repo(req.repo), req.issue_number, req.pr_url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except GitHubError as exc:
        raise HTTPException(502, str(exc)) from exc


# Public path is /api/* (vercel.json rewrite). Also mounted at / so the service still
# answers if the platform strips the /api prefix before forwarding.
app.include_router(router, prefix="/api")
app.include_router(router)
