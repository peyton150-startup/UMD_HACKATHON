# BountyBridge Lite



Match Hacktoberfest contributors to the right open-source issue with an open-weight LLM, then reward approved contributions on Solana Devnet with an on-chain record.



Built at Hacktoberfest Hack Day College Park × GDSC UMD (Oct 25, 2026).



## How it works



1. **Pick a repo, or let it find one.** "Find repos for me" (`GET /discover`) searches GitHub for active `hacktoberfest` repos in your languages with 3+ open good first issues (cached 15 min). The backend then fetches the chosen repo's open `good first issue` issues.

2. **AI recommends.** An open-weight model returns 3 recommendations as JSON. Python validates them with Pydantic and **rejects any issue number GitHub did not return**, retrying once with the error fed back.

3. **GitHub verifies the PR.** `POST /verify-pr` checks with the GitHub API that the PR exists, belongs to the repo, and is merged. Pay stays locked until it passes.

4. **Maintainer approves and pays.** The maintainer signs a Devnet SOL transfer with a memo (`repo#issue` + PR link) in their own wallet, in one transaction. No private keys live on the server. The app is locked to Devnet.



If a repo has no issues with the requested label, the backend falls back to all open issues and says so. GitHub issue lists are cached for 5 minutes.



## AI models



All three are called through one OpenAI-compatible interface (`backend/agent/provider.py`) and tried in order:



1. **Gemma 4 26B A4B** (Google, **open-weight**). Served by the Gemini API on `GEMINI_API_KEY`, with thinking set to "minimal". About 12–15 s, valid JSON first try.

2. **Gemini 3.5 Flash** (Google, same key). Thinking off, about 4 s. Used if Gemma errors.

3. **NVIDIA Nemotron 3.5 Lightning** (**open-weight**, NVIDIA hosted API). Thinking off, about 7 s. Used if Google is down.



A fourth backup, **Groq**, is used only if `GROQ_API_KEY` is set.

`PROVIDER_ORDER` (default `gemma,gemini,nvidia,groq`) changes the order; providers without a key are skipped. `GEMMA_MODEL`, `GEMINI_MODEL`, `NVIDIA_MODEL` and `GROQ_MODEL` override the models. Whatever comes back is validated with Pydantic and checked against real GitHub issue numbers before it reaches the UI.



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

GEMINI_API_KEY=            # Gemma 4 (primary) + Gemini Flash (backup)

NVIDIA_API_KEY=            # Nemotron (second backup)

GITHUB_TOKEN=              # public-repo read; raises GitHub limits a lot

# optional: PROVIDER_ORDER=gemma,gemini,nvidia

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



### Payout test on a local chain

`frontend/tests/payout.test.tsx` runs the real payout UI against a throwaway **offline** Surfpool chain (never Devnet or Mainnet). It uses a mock wallet and checks four things:
- Pay stays locked until the PR check passes.
- One transaction moves 0.05 SOL and carries the bounty memo, with the maintainer as the signer.
- A second payout for the same issue is blocked.
- The on-chain ledger lists the payout.

```bash
# terminal 1 (on Windows, Surfpool runs inside WSL)
wsl -d Ubuntu -- bash -lc "surfpool start --offline --no-tui"
# terminal 2
cd frontend
npm run test:chain
```

If no chain is listening on `127.0.0.1:8899`, the suite is skipped. Set `SURFPOOL_RPC_URL` / `SURFPOOL_WS_URL` to use another endpoint.

## Deploy (Vercel)



`vercel.json` defines two services in one project. `/api/*` goes to the FastAPI `backend` and everything else goes to the Next.js `frontend`, all on one domain. Set `GEMINI_API_KEY`, `NVIDIA_API_KEY` and `GITHUB_TOKEN` as project environment variables in the Vercel dashboard.



## Demo



See [DEMO.md](DEMO.md) for the 3-minute demo script and pre-demo checklist.



## License



MIT

