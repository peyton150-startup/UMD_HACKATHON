# BountyBridge demo script (about 3 minutes)

**Demo repo:** [`collective/icalendar`](https://github.com/collective/icalendar), an active Python library with 38 open `good first issue` issues and a CONTRIBUTING guide.
**Backup repo:** [`evennia/evennia`](https://github.com/evennia/evennia), a Python engine for retro text games (fits the arcade theme, but its beginner issues are older and bigger).
**PR link for the payout:** `https://github.com/collective/icalendar/pull/1989` (a real merged PR in that repo, used as the stand-in "contributor's PR").

---

## Before judging (do this at least 30 minutes ahead)

- [ ] **Keys:** `backend/.env` has `NVIDIA_API_KEY` (and ideally `GROQ_API_KEY`) plus `GITHUB_TOKEN`
- [ ] **Servers:** backend running (`cd backend` then `.venv/Scripts/python -m uvicorn main:app`) and frontend running (`cd frontend` then `npm run dev`)
- [ ] **Phantom on Devnet:** Settings → Developer Settings → turn on Testnet Mode → choose Solana **Devnet**
- [ ] **Two accounts in Phantom:** rename Account 1 to **Maintainer**, then add Account 2 and name it **Contributor**. Copy the Contributor address into a notepad.
- [ ] **Fund the Maintainer:** go to <https://faucet.solana.com>, paste the Maintainer address, and request 1–2 SOL (signing in with GitHub raises the limit). The Contributor needs no SOL.
- [ ] **Fill the replay cache:** run one real search for `collective/icalendar` so the offline fallback has data
- [ ] **Rehearse one payout** on a *different* issue than the one you'll use live, so High Scores already shows 1 entry
- [ ] **Screen-record** one full run as a backup video
- [ ] Browser zoom at 125%, other tabs closed, Phantom pinned in the toolbar, Maintainer account selected

---

## Script

### 0:00 Hook (15 s)
> "The hardest part of Hacktoberfest for a newcomer is the first half hour: which issue do I pick? And maintainers have no lightweight way to reward the people who show up. BountyBridge fixes both: an open-weight AI picks your quest, and Solana pays the bounty and keeps score."

### 0:15 Level 1: Choose your repo (30 s)
- Type `collective/icalendar`, languages `python`, **Beginner**, 4 hours, then click **Insert coin**.
> "While it loads: the backend pulls the real open `good first issue` issues from GitHub and sends them to NVIDIA's **Nemotron**, an open-weight model, with Qwen on Groq as an automatic fallback."

### 0:45 Level 2: Pick a quest (45 s)
- Point to the **✓ verified on GitHub** badge and the line showing *model* and *validated on attempt N*.
> "The model only *suggests*. Python validates its JSON with Pydantic and checks every issue number against what GitHub actually returned. If the model makes one up, we reject the answer and retry with the error. That's this attempt counter."
- Open **Game plan** on the top quest: steps and files to look at. Click **Accept quest**.

### 1:30 Level 3: Approve and pay (45 s)
> "Now I'm the maintainer. The contributor opened a PR and it got merged."
- Paste the Contributor address and the PR link, and leave the amount at 0.05.
- Click **Verify**. The backend asks GitHub whether the PR is in this repo and merged. It shows **GITHUB CHECK: PASSED** with the merge date and author.
> "GitHub, not the AI, decides whether work is payable. The Pay button stays locked until this check passes."
- (Optional, 10 s) Paste an open PR, e.g. `https://github.com/collective/icalendar/pull/2028` if it's still open, then click Verify and show **FAILED: PR is not merged yet**. Paste the merged one back.
- Point to the **On-chain memo** preview: `bountybridge:v1|collective/icalendar#…|…/pull/1989`.
- Tick the approval box.
> "The AI suggests, a human approves, and the wallet signs. No private keys live on our server."
- Click **Pay**, then approve in Phantom. When **QUEST COMPLETE!** appears, click **View transaction** and show the explorer: **two instructions in one transaction**, the SOL transfer and the memo.

### 2:15 Level 4: High scores (25 s)
- The Contributor address is already filled in. Click **Load scores**.
> "There's no database. This scoreboard is read straight from the blockchain, so anyone can check a contributor's record."
- Scroll back up and click **Pay** again on the same quest. It gets **blocked as already paid**, because the app checks the chain history first.

### 2:40 Close (20 s)
> "It's MIT-licensed, runs on an open-weight model, falls back to a second provider automatically, and keeps the AI's suggestions separate from the payments a human approves. Next steps: link each wallet to a GitHub account, and add a real escrow program."

---

## If something breaks

| Problem | What to do |
|---|---|
| Model slow or down | The page automatically replays the last real result (gold **OFFLINE REPLAY** tag). Say so honestly. |
| Backend crashed | Same replay fallback. Restart uvicorn in a second terminal. |
| Phantom won't pop up | Click the Phantom icon in the toolbar; check it's on **Devnet** and the Maintainer account is selected. |
| "Insufficient SOL" | Switch to the backup Phantom account you funded, or lower the bounty to 0.01. |
| Wi-Fi dies | Play the backup video. |

## Likely judge questions

- **Why a blockchain instead of a database?** The payment and the contribution record are the same public, checkable object. Contributors own their record. It works across repos with no central server to trust.
- **What stops the AI from making things up?** Schema validation, plus cross-checking every issue number against GitHub, plus one retry with the error, then a clean failure. Tested in `backend/tests/test_orchestrator.py`.
- **Why open-weight?** It can be self-hosted, so maintainers aren't locked into one vendor. The provider is a config switch (`backend/agent/provider.py`).
- **How do you know the PR was merged?** The `/verify-pr` endpoint asks GitHub's API for the repo, merge status and author. Pay stays disabled until that passes, and editing the link resets the check.
- **What isn't done yet?** It's Devnet only (mainnet is locked out in the UI). Whether the PR actually fixes the issue is still the maintainer's call; the app flags PRs that don't mention the issue number. Nothing links a wallet to a GitHub account yet. The duplicate-payout check only scans the contributor's last 100 transactions. Escrow is the next step.
