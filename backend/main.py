"""FastAPI entry point. Run from backend/: uvicorn main:app --reload"""

from dotenv import load_dotenv

load_dotenv()  # read ../.env or backend/.env before building providers

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from agent.models import (  # noqa: E402
    PrVerification,
    RecommendRequest,
    RecommendResponse,
    VerifyPrRequest,
)
from agent.orchestrator import NoIssuesError, RecommendationError, recommend  # noqa: E402
from agent.provider import ProviderError, build_provider_from_env  # noqa: E402
from services.github_service import GitHubError, GitHubService, parse_repo  # noqa: E402

app = FastAPI(title="BountyBridge Lite API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

github = GitHubService()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/recommend", response_model=RecommendResponse)
def recommend_endpoint(req: RecommendRequest) -> RecommendResponse:
    try:
        return recommend(req, github, build_provider_from_env())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except NoIssuesError as exc:
        raise HTTPException(404, str(exc)) from exc
    except (GitHubError, ProviderError, RecommendationError) as exc:
        raise HTTPException(502, str(exc)) from exc


@app.post("/verify-pr", response_model=PrVerification)
def verify_pr_endpoint(req: VerifyPrRequest) -> PrVerification:
    """GitHub, not the model, decides whether a contribution is payable."""
    try:
        return github.verify_pull_request(parse_repo(req.repo), req.issue_number, req.pr_url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except GitHubError as exc:
        raise HTTPException(502, str(exc)) from exc
