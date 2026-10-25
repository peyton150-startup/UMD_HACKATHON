"use client";

import { useEffect, useState } from "react";

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

const EXPECTED_MS = 14_000;
const SEGMENTS = 20;

export function LoadingScreen({ repo }: { repo: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(timer);
  }, []);

  // eases toward 95% so the bar never claims to be done before the answer is
  const progress = 0.95 * (1 - Math.exp(-elapsed / (EXPECTED_MS / 2.5)));
  const filled = Math.round(progress * SEGMENTS);
  const tip = TIPS[Math.floor(elapsed / 3500) % TIPS.length];

  return (
    <div className="pixel-box p-5 text-center" role="status" aria-live="polite">
      <p className="blink font-pixel text-[0.7rem] text-gold">
        LOADING LEVEL 2...
      </p>
      <p className="mt-3 text-muted">
        AI is reading the open issues in{" "}
        <span className="text-foreground">{repo}</span>
      </p>
      <div
        className="mx-auto mt-4 flex max-w-md justify-center gap-[3px]"
        aria-hidden="true"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`h-4 flex-1 ${i < filled ? "bg-primary" : "bg-border-low"}`}
          />
        ))}
      </div>
      <p className="mt-2 font-pixel text-[0.5rem] text-muted">
        {Math.round(progress * 100)}% · {(elapsed / 1000).toFixed(0)}s
      </p>
      <p className="mx-auto mt-4 max-w-xl text-lg">
        <span className="text-neon">TIP:</span> {tip}
      </p>
    </div>
  );
}
