"use client";

import { ClusterSelect } from "./cluster-select";
import { WalletButton } from "./wallet-button";

export function AppHeader() {
  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
      <span className="font-pixel text-xs leading-relaxed sm:text-sm">
        <span className="text-gold">★</span> BOUNTY
        <span className="text-primary">BRIDGE</span>
      </span>
      <div className="flex items-center gap-3">
        <ClusterSelect />
        <WalletButton />
      </div>
    </header>
  );
}
