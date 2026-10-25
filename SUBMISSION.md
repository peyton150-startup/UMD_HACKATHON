# BountyBridge: MLH submission draft

Paste-ready text for the Hacktoberfest Hack Day College Park × GDSC UMD submission.

- **Live demo:** https://frontend-nine-zeta-orqexn6sj7.vercel.app
- **Code:** https://github.com/peyton150-startup/UMD_HACKATHON (MIT)
- **Prize categories:** Best Open-Source AI Project · Best Use of Solana · UI/UX Design Challenge
  (optional: Tech For Good, UMD Challenge; see the notes at the bottom)

---

## Tagline

An open-weight AI finds the open-source issue that fits you, GitHub proves your PR was merged, and Solana pays the bounty and keeps the score.

## Inspiration

Hacktoberfest's hardest moment for a newcomer is the first half hour: *which issue do I pick?* Maintainers have the opposite problem, with no lightweight way to reward the people who show up. We wanted one loop that fixes both, built so the AI is useful without ever being trusted with money.

## What it does

BountyBridge is a four-level arcade game:

1. **Choose your repo.** Type a repo, or press **Find repos for me**. That searches GitHub for active Hacktoberfest repos in your languages with 3+ open good first issues. Typing an owner such as `microsoft/` searches that org instead.
2. **Pick a quest.** An open-weight model reads the repo's real open issues and recommends three, with a fit score, a rationale, a step-by-step plan and the files to look at. Beginner, intermediate and advanced get *different* issues (good first issue → help wanted → anything), not just a reordered list.
3. **Approve and pay.** The maintainer pastes the merged PR link. GitHub (not the AI) confirms the PR exists, belongs to the repo and is merged. The maintainer ticks an approval box and signs **one Solana Devnet transaction** containing the SOL transfer *and* an on-chain memo `bountybridge:v1|owner/repo#issue|PR link`.
4. **High scores.** Any wallet's BountyBridge history is read straight from the chain, so there's no database. Paying the same issue to the same contributor twice is blocked by checking that history first.

**The AI suggests, GitHub verifies, a human approves, and the wallet signs.**

## How we built it

- **AI (open-weight first):** Google **Gemma 4 26B A4B** (open-weight) via the Gemini API as the primary model, with **Gemini 3.5 Flash** and NVIDIA **Nemotron 3.5 Lightning** (open-weight) as automatic backups. One OpenAI-compatible provider interface. Thinking is turned to minimal/off, which cut latency from ~40 s to ~4–14 s with the same valid output.
- **Guardrails:** Python validates every reply with **Pydantic** and checks each issue number against the issues GitHub actually returned. An invented issue is rejected and the model retries once with the error. The UI shows which model answered and on which attempt.
- **Backend:** **FastAPI** (`/recommend`, `/discover`, `/verify-pr`), httpx, GitHub REST and Search APIs, small caches to respect rate limits.
- **Frontend:** **Next.js** + Tailwind, a retro arcade theme (Press Start 2P / VT323, CRT scanlines) with UMD red for actions and UMD gold for rewards; it works at phone width.
- **Solana:** `@solana/kit` with Wallet Standard wallets (Solflare, Phantom), plus a built-in **Demo Wallet (Devnet)** for machines without an extension. Transfer + SPL Memo in a single transaction; history from `getSignaturesForAddress`. The app is locked to Devnet.
- **Hosting:** two **Vercel** projects. The frontend proxies `/api/*` to the FastAPI backend, so there's no CORS setup.
- **Testing:** 30 backend tests (validation, PR checks, discovery, provider fallback) and frontend unit tests. There's also an automated **payout test on an offline local Surfpool chain**: Pay stays locked until the PR check passes, one transaction moves 0.05 SOL with the memo, a duplicate is blocked, and the ledger lists the payout.

## Challenges we ran into

- **Slow "thinking" models.** Default reasoning made Nemotron take 40 s and Gemma 77 s with broken JSON. Turning it off or to minimal, and trimming the prompt, got us to seconds without losing validity.
- **Hallucinated issues.** We made validation, not the prompt, the safety net. The model can only point at issues GitHub actually returned.
- **Difficulty that didn't change anything.** Early on, every level got the same beginner issues in a new order. Fetching a different issue pool per level fixed it.
- **Wallets on a locked-down laptop.** That's why we built the in-browser Devnet demo wallet on the same Wallet Standard interface.
- **Deploying two services.** We moved from a single services config to two Vercel projects with a same-origin proxy.

## Accomplishments we're proud of

- The AI never touches money, and every AI claim is checked against GitHub before the user sees it.
- One atomic transaction = payment + public, verifiable contribution record.
- Automatic model fallback that we actually watched happen live when Gemini was overloaded.

## What we learned

Separating responsibilities is what makes an AI feature trustworthy: the model proposes, deterministic code validates, external systems (GitHub, Solana) are the source of truth, and a human authorizes anything irreversible.

## What's next

- An on-chain escrow program, so bounties are locked when posted and released on approval.
- Linking a wallet to a GitHub account, so payouts go to the PR author's verified wallet.
- Automatically detecting merged PRs via GitHub webhooks.

## Honest limitations

Devnet only, with no escrow yet. Whether a PR actually fixes the issue is the maintainer's call (the app flags PRs that don't mention the issue). The duplicate check scans the contributor's last 100 transactions. The demo wallet keeps a throwaway Devnet key in the browser.

---

### Prize category notes

| Category | Fit |
|---|---|
| **Best Open-Source AI Project** | Strong: open-weight Gemma 4 is the primary model, Nemotron is the open-weight backup, MIT-licensed repo |
| **Best Use of Solana** | Strong: real Devnet transfers + memo records, on-chain ledger, Wallet Standard |
| **UI/UX Design Challenge** | Good: arcade theme, clear four-level flow, human-readable errors, mobile layout |
| Tech For Good | Possible: lowers the barrier for first-time open-source contributors |
| UMD Challenge | Possible: UMD red/gold theme, built at GDSC UMD |
