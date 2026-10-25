"use client";

import { useEffect, useState } from "react";
import { SearchStatus } from "./search-status";

// Shown while the model reads the issues (~5-15 s). Tips double as a pitch.
const TIPS = [
  "The AI only suggests. Python checks every issue number against GitHub.",
  "Invented an issue? The answer is rejected and the model retries.",
  "Gemma 4 is open-weight. Gemini Flash and Nemotron step in if it's busy.",
  "Beginner, intermediate and advanced each get a different issue pool.",
  "Payouts are one Solana transaction: the SOL and a public memo record.",
  "No database: high scores are read straight from the blockchain.",
  "GitHub, not the AI, decides whether a PR was merged.",
];

const SEGMENTS = 20;

export function LoadingScreen({ repo }: { repo: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(timer);
  }, []);

  // A looping scan, not a completion percentage: the backend returns one response.
  const scanner = Math.floor(elapsed / 200) % SEGMENTS;
  const tip = TIPS[Math.floor(elapsed / 3500) % TIPS.length];

  return (
    <div className="pixel-box p-5 text-center">
      <p className="blink font-pixel text-[0.7rem] text-gold">
        LOADING LEVEL 2...
      </p>
      <p className="mt-3 text-muted">
        Finding matching issues in{" "}
        <span className="text-foreground">{repo}</span>
      </p>
      <div
        className="mx-auto mt-4 flex max-w-md justify-center gap-[3px]"
        aria-hidden="true"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`h-4 flex-1 ${i === scanner ? "bg-primary" : "bg-border-low"}`}
          />
        ))}
      </div>
      <SearchStatus />
      <p className="mx-auto mt-4 max-w-xl text-lg">
        <span className="text-neon">TIP:</span> {tip}
      </p>
    </div>
  );
}
