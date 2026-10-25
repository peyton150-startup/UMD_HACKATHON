"""Smoke test: one tiny JSON task per configured provider. Prints no secrets.

Run from backend/:  .venv/Scripts/python scripts/smoke_model.py
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")  # project-root .env

from agent.provider import ProviderError, build_provider_from_env  # noqa: E402

TASK = [
    {"role": "system", "content": "Reply with JSON only."},
    {
        "role": "user",
        "content": 'Classify this GitHub issue title as "docs", "bug", or "feature" and '
        'give a difficulty 1-5. Title: "Fix typo in README installation section". '
        'Shape: {"category": str, "difficulty": int}',
    },
]


def main() -> int:
    try:
        fallback = build_provider_from_env()
    except ProviderError as exc:
        print(f"SETUP: {exc}")
        return 1

    failures = 0
    for provider in fallback.providers:
        start = time.perf_counter()
        try:
            raw = provider.complete(TASK)
        except ProviderError as exc:
            print(f"[{provider.name}] {provider.model}: FAILED after {time.perf_counter() - start:.1f}s -> {exc}")
            failures += 1
            continue
        took = time.perf_counter() - start
        try:
            parsed = json.loads(raw)
            status = f"valid JSON {parsed}"
        except json.JSONDecodeError:
            status = "NOT valid JSON"
            failures += 1
        print(f"[{provider.name}] {provider.model}: {took:.1f}s, {status}")
        print(f"    raw: {raw[:300]!r}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
