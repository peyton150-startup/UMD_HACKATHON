"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { PropsWithChildren, useEffect } from "react";
import { ClusterProvider } from "./cluster-context";
import { AppClientProvider } from "../lib/client-provider";
import { registerDemoWallet } from "../lib/demo-wallet";

export function Providers({ children }: PropsWithChildren) {
  // adds "Demo Wallet (Devnet)" to Connect Wallet, for machines without an extension
  useEffect(() => {
    registerDemoWallet().catch((err) => console.error("demo wallet:", err));
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <ClusterProvider>
        <AppClientProvider>{children}</AppClientProvider>
        <Toaster position="bottom-right" richColors />
      </ClusterProvider>
    </ThemeProvider>
  );
}
