"use client";

/**
 * "Demo Wallet (Devnet)": a throwaway in-browser wallet for demos where no wallet
 * extension is available (locked-down laptops, a judge's machine).
 *
 * - Devnet only: it advertises only the solana:devnet chain, and the app is locked to
 *   Devnet anyway. Never send real funds to it.
 * - The 32-byte private key seed lives in this browser's localStorage, so the same
 *   address comes back after a refresh (fund it once from faucet.solana.com).
 * - It registers through the Wallet Standard, so it shows up in "Connect Wallet"
 *   next to Phantom/Solflare and signs exactly like they do; no app code changes.
 */
import {
  createKeyPairFromPrivateKeyBytes,
  getAddressFromPublicKey,
  getTransactionDecoder,
  getTransactionEncoder,
  partiallySignTransaction,
  signBytes,
} from "@solana/kit";
import { registerWallet } from "@wallet-standard/wallet";

const SEED_KEY = "bountybridge:demo-wallet-seed";
const CHAINS = ["solana:devnet"] as const;
const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" shape-rendering="crispEdges">' +
      '<rect width="16" height="16" fill="#ffd200"/><rect x="3" y="3" width="10" height="10" fill="#e21833"/>' +
      '<rect x="6" y="6" width="4" height="4" fill="#ffd200"/></svg>'
  );

function loadOrCreateSeed(): Uint8Array {
  try {
    const saved = localStorage.getItem(SEED_KEY);
    if (saved) {
      const bytes = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
      if (bytes.length === 32) return bytes;
    }
  } catch {
    // storage blocked: fall through to a session-only key
  }
  const seed = crypto.getRandomValues(new Uint8Array(32));
  try {
    localStorage.setItem(SEED_KEY, btoa(String.fromCharCode(...seed)));
  } catch {
    // session-only wallet; address changes on refresh
  }
  return seed;
}

let registered = false;

export async function registerDemoWallet(): Promise<void> {
  if (registered || typeof window === "undefined") return;
  registered = true;

  const keyPair = await createKeyPairFromPrivateKeyBytes(loadOrCreateSeed());
  const walletAddress = await getAddressFromPublicKey(keyPair.publicKey);
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey)
  );

  const account = {
    address: walletAddress,
    publicKey,
    chains: CHAINS,
    features: ["solana:signMessage", "solana:signTransaction"] as const,
  };
  let connected: (typeof account)[] = [];
  const listeners = new Set<
    (props: { accounts: (typeof account)[] }) => void
  >();
  const emit = () => listeners.forEach((fn) => fn({ accounts: connected }));

  registerWallet({
    version: "1.0.0",
    name: "Demo Wallet (Devnet)",
    icon: ICON as `data:image/svg+xml;base64,${string}`,
    chains: CHAINS,
    get accounts() {
      return connected;
    },
    features: {
      "standard:connect": {
        version: "1.0.0",
        connect: async () => {
          connected = [account];
          emit();
          return { accounts: connected };
        },
      },
      "standard:disconnect": {
        version: "1.0.0",
        disconnect: async () => {
          connected = [];
          emit();
        },
      },
      "standard:events": {
        version: "1.0.0",
        on: (
          _event: "change",
          fn: (props: { accounts: (typeof account)[] }) => void
        ) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      },
      "solana:signTransaction": {
        version: "1.0.0",
        supportedTransactionVersions: ["legacy", 0],
        signTransaction: async (
          ...inputs: readonly { transaction: Uint8Array }[]
        ) =>
          Promise.all(
            inputs.map(async ({ transaction }) => {
              const signed = await partiallySignTransaction(
                [keyPair],
                getTransactionDecoder().decode(transaction)
              );
              return {
                signedTransaction: new Uint8Array(
                  getTransactionEncoder().encode(signed)
                ),
              };
            })
          ),
      },
      "solana:signMessage": {
        version: "1.0.0",
        signMessage: async (...inputs: readonly { message: Uint8Array }[]) =>
          Promise.all(
            inputs.map(async ({ message }) => ({
              signedMessage: message,
              signature: new Uint8Array(
                await signBytes(keyPair.privateKey, message)
              ),
            }))
          ),
      },
    },
  } as Parameters<typeof registerWallet>[0]);
}
