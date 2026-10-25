import { ClientProvider } from "@solana/react";
import { Surfnet } from "@solana/surfpool";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useMemo } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "vitest";
import { ClusterProvider } from "../app/components/cluster-context";
import { WalletButton } from "../app/components/wallet-button";
import { createAppClient } from "../app/lib/solana-client";
import {
  mockWalletAddress,
  registerMockWallet,
  resetMockWallet,
} from "./mock-wallet";

const LAMPORTS_PER_SOL = 1_000_000_000;

let surfnet: Surfnet;

beforeAll(() => {
  surfnet = Surfnet.start();
  surfnet.fundSol(mockWalletAddress, 5 * LAMPORTS_PER_SOL);
  registerMockWallet();
}, 60_000);

afterAll(() => {
  surfnet?.stop();
});

beforeEach(() => {
  localStorage.clear();
  resetMockWallet();
});

afterEach(cleanup);

function TestApp() {
  const client = useMemo(
    () =>
      createAppClient("localnet", {
        rpcUrl: surfnet.rpcUrl,
        rpcSubscriptionsUrl: surfnet.wsUrl,
      }),
    []
  );
  return (
    <ClusterProvider>
      <ClientProvider client={client}>
        <WalletButton />
      </ClientProvider>
    </ClusterProvider>
  );
}

async function connectWallet() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Connect Wallet" })
  );
  fireEvent.click(await screen.findByRole("button", { name: "Mock Wallet" }));
  return await screen.findByRole("button", {
    name: `Wallet ${mockWalletAddress}`,
  });
}

test("connects the mock wallet and shows its on-chain balance", async () => {
  surfnet.fundSol(mockWalletAddress, 5 * LAMPORTS_PER_SOL);
  render(<TestApp />);

  const walletButton = await connectWallet();
  fireEvent.click(walletButton);

  await screen.findByText(mockWalletAddress);
  await waitFor(
    () => {
      const balance = screen.getByText("Balance").nextElementSibling;
      expect(balance?.textContent).toBe("5 SOL");
    },
    { timeout: 10_000 }
  );
});
