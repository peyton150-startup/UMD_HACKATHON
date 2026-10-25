"use client";

import { useEffect, useState } from "react";

export function SearchStatus() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="mt-4 border-l-3 border-gold bg-accent p-3" role="status">
      <p className="text-gold">
        Finding matching issues…{" "}
        <span className="tabular-nums">{elapsed}s elapsed</span>
      </p>
      <p className="text-muted">
        Recommendations typically take 10–25 seconds. Larger repositories and
        model retries can take longer.
      </p>
      {elapsed >= 30 && (
        <p className="mt-1">
          Still waiting for the backend. You can keep this page open.
        </p>
      )}
    </div>
  );
}
