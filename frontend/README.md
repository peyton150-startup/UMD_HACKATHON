# BountyBridge frontend

The Next.js app for BountyBridge. See the [project README](../README.md) for what the app does and how to run the backend.

## Run it

Requires Node.js 24 or newer.

```shell
npm install
npm run dev
```

Open <http://localhost:3000>. In dev, `/api/*` is forwarded to the FastAPI backend at `http://localhost:8000` (see [`next.config.ts`](next.config.ts)). In production it goes to `BACKEND_URL`.

Connect a wallet set to **Devnet**. You can get Devnet SOL from [faucet.solana.com](https://faucet.solana.com/). The app blocks payouts on Mainnet.

## Where things are

| Path                                                                   | What it is                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`app/page.tsx`](app/page.tsx)                                         | The four levels: choose repo, pick a quest, approve and pay, high scores     |
| [`app/components/bounty/`](app/components/bounty/)                     | Repo form, quest cards, payout panel, on-chain ledger                        |
| [`app/lib/api.ts`](app/lib/api.ts)                                     | Calls to the backend, plus the offline replay cache                          |
| [`app/lib/memo.ts`](app/lib/memo.ts)                                   | Builds and parses the `bountybridge:v1` on-chain memo                        |
| [`app/lib/solana-client.ts`](app/lib/solana-client.ts)                 | One `@solana/kit` client per cluster (wallet, RPC, system and memo programs) |
| [`app/components/wallet-button.tsx`](app/components/wallet-button.tsx) | Wallet connect menu with live SOL balance                                    |

## Checks

Saved quests and contribution checklists are kept in browser storage. Resuming a quest restores its recommendation, not its approval or wallet state. The starter guide links to files pinned to a GitHub commit. Reward receipts can be copied or shared only after the on-chain checks pass.

```shell
npm run ci          # build, typecheck, lint, format check, tests
npm run test:chain  # payout test against a local Surfpool chain
npx vitest run tests/quest-library.test.ts tests/quest-flow.test.tsx tests/contributor-ui.test.tsx tests/reward-receipt.test.tsx tests/storage-failure.test.tsx
```

The tests render the real components with a mock wallet ([`tests/mock-wallet.ts`](tests/mock-wallet.ts)) and a local Solana chain from [`@solana/surfpool`](https://www.npmjs.com/package/@solana/surfpool). Surfpool only ships for macOS and Linux, so on Windows the chain tests need WSL (see the project README).
