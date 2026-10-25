"""A small, immutable GitHub snapshot, bounded in requests, bytes and time."""

import base64
import binascii
import re
import time
from urllib.parse import quote

import httpx

from agent.models import Issue, RepoContext, RepoDocument

MAX_FILES = 800
MAX_PATH_CHARS = 32_000
MAX_DOCUMENT_BYTES = 200_000
CONTEXT_BUDGET_S = 12
SOURCE_EXTENSIONS = {"py", "ts", "tsx", "js", "jsx", "go", "rs", "java", "c", "cpp", "rb"}


def fetch_repo_context(client: httpx.Client, repo: str, issues: list[Issue]) -> RepoContext:
    deadline = time.monotonic() + CONTEXT_BUDGET_S

    def get(path, **kwargs):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("repository context budget exhausted")
        response = client.get(path, timeout=min(3.0, remaining), **kwargs)
        response.raise_for_status()
        return response.json()

    try:
        metadata = get(f"/repos/{repo}")
        branch = metadata["default_branch"]
        revision = get(f"/repos/{repo}/commits/{quote(branch, safe='')}")["sha"]
        tree = get(f"/repos/{repo}/git/trees/{revision}", params={"recursive": "1"})
        all_files = sorted({entry["path"] for entry in tree["tree"]
            if entry.get("type") == "blob" and len(entry["path"]) <= 400})
        guide_paths = [p for p in all_files if p.lower() in {
            "readme.md", "readme.rst", "readme", "contributing.md", "contributing.rst",
            ".github/contributing.md", "docs/contributing.md", "docs/contributing.rst",
        }]
        # Keep guides even when the tree is too large to send to the model.
        files = []
        chars = 0
        for path in dict.fromkeys(guide_paths + all_files):
            if len(files) >= MAX_FILES or chars + len(path) > MAX_PATH_CHARS:
                break
            files.append(path)
            chars += len(path)
        context = RepoContext(available=True, revision=revision, files=files,
            truncated=bool(tree.get("truncated")) or len(files) < len(all_files))
    except (httpx.HTTPError, ValueError, KeyError, TypeError, TimeoutError):
        return RepoContext(warning="Repository context could not be loaded. Recommendations use issue descriptions only.")

    def document(path: str, max_chars: int) -> RepoDocument | None:
        try:
            data = get(f"/repos/{repo}/contents/{quote(path, safe='/')}", params={"ref": revision})
            if data.get("encoding") != "base64" or data.get("size", 0) > MAX_DOCUMENT_BYTES:
                return None
            encoded = data.get("content", "")
            if len(encoded) > MAX_DOCUMENT_BYTES * 2:
                return None
            raw = base64.b64decode(encoded)
            if len(raw) > MAX_DOCUMENT_BYTES or b"\0" in raw:
                return None
            excerpt = raw.decode("utf-8")[:max_chars]
            return RepoDocument(path=path, url=f"https://github.com/{repo}/blob/{revision}/{quote(path, safe='/')}", excerpt=excerpt)
        except (httpx.HTTPError, ValueError, KeyError, TypeError, TimeoutError, UnicodeError, binascii.Error):
            return None

    # Prefer the README plus contribution instructions, with at most three docs.
    for path in guide_paths[:3]:
        doc = document(path, 4500)
        if doc:
            context.guides.append(doc)

    terms = set(re.findall(r"[a-z][a-z0-9_]{3,}", " ".join(i.title for i in issues).lower()))

    def score(path):
        return sum(term in path.lower() for term in terms)

    sources = [p for p in files if p.rsplit(".", 1)[-1].lower() in SOURCE_EXTENSIONS and score(p) > 0]
    for path in sorted(sources, key=lambda p: (-score(p), len(p), p))[:2]:
        doc = document(path, 2500)
        if doc:
            context.code_samples.append(doc)
    if not context.guides:
        context.warning = "No readable starter documents were available; browse the repository for setup instructions."
    return context
