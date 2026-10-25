# Contributor Experience Implementation Plan

**Goal:** Implement the five approved conveniences plus repository-grounded recommendations, then commit and push.

**Architecture:** Extend the existing FastAPI response with a cached, bounded GitHub snapshot. Keep saved quests, the accepted quest, and checklist progress in browser storage. Reuse the current transaction receipt verification for shareable receipts. Preserve the arcade design and payment approval rules.

**Tech Stack:** Existing Python/httpx/Pydantic, Next.js/React/TypeScript, browser storage and clipboard APIs. No new dependencies.

**Spec:** User approved all additions in the preceding chat and requested commit and push.

## Constraints and review focus

- Restoring a quest must never restore wallet approval or trigger a payment.
- Storage corruption or unavailable storage must not break the app; saved results are explicitly historical.
- Checklist progress must be scoped to repository, issue and step content.
- Missing/large/truncated GitHub context must degrade honestly; never link invented files.
- Receipt sharing must use the immutable submitted transaction details, not edited form fields, and label Devnet and verification status accurately.
- Keep loading feedback honest, accessible and stopped on completion/unmount.

## Tasks

1. Repository context: add bounded snapshot models/retrieval, five-minute cache, docs and relevant code excerpts. Feed context into the prompt, filter model paths to the snapshot, include it in the response. Test retrieval, truncation, errors, cache expiry, prompt grounding and path filtering.
2. Saved quests/checklists: add validated versioned browser storage helpers and cards with save/resume/remove controls. Restore the accepted quest with a saved-result notice and a fresh payout form. Test persistence, corruption, repo isolation, restore/drop and checklist behavior.
3. Loading/starter guide: add an elapsed-time status and a guide with actual GitHub docs/files. Test elapsed-time cleanup and verified links/unavailable context.
4. Reward receipt: capture immutable payment details, show a receipt with amount/wallets/issue/PR/explorer and copy/share actions. Keep existing on-chain verification visible. Test share content, verification labels and clipboard fallback.
5. Verify backend tests, frontend focused tests, TypeScript, lint, formatting and production build; review the complete diff; document limitations, commit and push the existing branch.

## Verification record

- Backend: `python -m pytest -q` — 42 passed, including the concurrently added quest-count tests.
- Frontend final run: `npm test -- --exclude tests/app.test.tsx` with the offline validator configured — 40 passed across 9 suites. This includes persistence/capacity, checklist isolation, storage failures, resume/search interaction, grounded links, honest loading, receipt sharing and all payout tests. Only the existing Windows-incompatible native-addon wallet suite was excluded.
- Payout integration: `npm run test:chain` against an ephemeral offline WSL Surfpool validator at ports 18899/18900 — all 4 passed, including the verified receipt.
- TypeScript and ESLint passed.
- `npm run build -- --webpack` passed, including prerendering. Default Turbopack build failed twice on this Windows host while starting its CSS worker, including outside the sandbox; no application compilation diagnostic was reported. No bundler configuration was changed.
- Real GitHub + model smoke: first request was correctly rejected for repeated issue IDs. After making the allowed issue count/numbers explicit, Gemma returned two unique, validated recommendations on the first attempt in 24.04s. Snapshot: 512 paths, CONTRIBUTING.md, README.rst, two code excerpts, pinned revision 4e529543e57b6dd88cd838254ac8aeec1e61af9e. All suggested paths existed in that snapshot.
- Independent review found repository casing, resume/search race, and fake loader percentage issues. Each was reproduced by a failing test and fixed. Existing concurrent arcade-loader/profile-link and quest-count additions were preserved.
- The legacy native Surfpool wallet suite requires a platform addon unavailable on Windows; the payout suite instead used the existing WSL CLI, without Devnet transactions.
