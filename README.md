# BountyBridge Lite

Match Hacktoberfest contributors to the right open-source issue with an open-weight LLM, then reward approved contributions on Solana Devnet with an on-chain record.

Built at Hacktoberfest Hack Day College Park × GDSC UMD (Oct 25, 2026).

## How it works

1. **Pick a repo, or let it find one.** "Find repos for me" (`GET /discover`) searches GitHub for active `hacktoberfest` repos in your languages with 3+ open good first issues (cached 15 min). The backend then fetches the chosen repo's open `good first issue` issues.
2. **AI recommends.** An open-weight model returns 1–3 recommendations as JSON. Python validates them with Pydantic and **rejects any issue number GitHub did not return**, retrying once with the error fed back.
3. **GitHub verifies the PR.** `POST /verify-pr` checks with the GitHub API that the PR exists, belongs to the repo, and is merged. Pay stays locked until it passes.
4. **Maintainer approves and pays.** The maintainer signs a Devnet SOL transfer with a memo (`repo#issue` + PR link) in their own wallet, in one transaction. No private keys live on the server. The app is locked to Devnet.

If a repo has no issues with the requested label, the backend falls back to all open issues and says so. GitHub issue lists are cached for 5 minutes.

## AI models

- **Primary:** Google **Gemini 3.5 Flash** (Gemini API, thinking off, about 4 s)
- **Backup:** NVIDIA **Nemotron 3.5 Lightning** (open-weight, NVIDIA hosted API, thinking off, about 6 s). Used automatically when Gemini errors or is overloaded.
- All providers share one OpenAI-compatible interface (`backend/agent/provider.py`). `PROVIDER_ORDER` in `.env` sets the order (default `gemini,nvidia,groq`); providers without a key are skipped.
- Whatever the model returns is validated with Pydantic and checked against real GitHub issue numbers before it reaches the UI.

## Stack

| Part | Tech |
|---|---|
| Backend | Python, FastAPI, Pydantic, httpx, pytest |
| Frontend | Next.js, Tailwind, `@solana/kit` (from `create-solana-dapp`) |
| Chain | Solana Devnet |
| Hosting | Vercel (one project, two services: `frontend` at `/`, `backend` at `/api`) |

## Run it locally

Create a `.env` in the project root, next to this README (never commit it; it's gitignored):

```
GEMINI_API_KEY=            # primary
NVIDIA_API_KEY=            # backup
GITHUB_TOKEN=              # public-repo read; raises GitHub limits a lot
# optional: PROVIDER_ORDER=gemini,nvidia   GEMINI_MODEL=gemini-3.5-flash
```

```bash
# backend (http://localhost:8000/docs)
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m uvicorn main:app --reload
.venv/Scripts/python -m pytest

# frontend (http://localhost:3000); /api/* is proxied to the backend in dev
cd frontend
npm install
npm run dev
```

## Deploy (Vercel)

`vercel.json` defines two services in one project. `/api/*` goes to the FastAPI `backend` and everything else goes to the Next.js `frontend`, all on one domain. Set `GEMINI_API_KEY`, `NVIDIA_API_KEY` and `GITHUB_TOKEN` as project environment variables in the Vercel dashboard.

## Demo

See [DEMO.md](DEMO.md) for the 3-minute demo script and pre-demo checklist.

## License

MIT
