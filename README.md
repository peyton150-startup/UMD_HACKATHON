# BountyBridge Lite

Match Hacktoberfest contributors to the right open-source issue with an open-weight LLM, then reward approved contributions on Solana Devnet with an on-chain record.

Built at Hacktoberfest Hack Day College Park × GDSC UMD (Oct 25, 2026).

## How it works

1. **Pick a repo.** The backend fetches open `good first issue` issues from the GitHub REST API.
2. **AI recommends.** An open-weight model returns 1–3 recommendations as JSON. Python validates them with Pydantic and **rejects any issue number GitHub did not return**, retrying once with the error fed back.
3. **Maintainer approves and pays.** The maintainer signs a Devnet SOL transfer with a memo (issue URL + PR link) in their own wallet. No private keys live on the server.

## Open-source AI

- **Primary model:** NVIDIA Nemotron 3.5 Lightning (open-weight), via NVIDIA's hosted API
- **Fallback:** Qwen (open-weight), via Groq
- Both are called through one OpenAI-compatible provider interface (`backend/agent/provider.py`), so swapping models is a config change.

## Stack

| Part | Tech |
|---|---|
| Backend | Python, FastAPI, Pydantic, httpx, pytest |
| Frontend | Next.js, Tailwind, `@solana/kit` (from `create-solana-dapp`) |
| Chain | Solana Devnet |

## Run it

Create a `.env` in `backend/` (never commit it) with at least one model key:

```
NVIDIA_API_KEY=            # primary
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning
GROQ_API_KEY=              # fallback
GROQ_MODEL=qwen/qwen3.8-27b
GITHUB_TOKEN=              # public-repo read; raises rate limit 60 -> 5000/hr
```

```bash

# backend (http://localhost:8000/docs)
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m uvicorn main:app --reload
.venv/Scripts/python -m pytest

# frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

## License

MIT
