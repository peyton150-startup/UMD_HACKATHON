import type { RepoContext } from "../../lib/api";

export function fileUrl(
  repo: string,
  context: RepoContext | undefined,
  path: string
): string | null {
  if (
    !context?.available ||
    !/^[a-f0-9]{40}$/i.test(context.revision) ||
    !context.files.includes(path) ||
    path.split("/").some((part) => part === ".." || part === ".")
  )
    return null;
  return `https://github.com/${repo}/blob/${context.revision}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function StarterGuide({
  repo,
  context,
  files = [],
}: {
  repo: string;
  context?: RepoContext;
  files?: string[];
}) {
  const guides =
    context?.guides.filter((doc) => fileUrl(repo, context, doc.path)) ?? [];
  const relevant = [...new Set(files)].filter((path) =>
    fileUrl(repo, context, path)
  );
  return (
    <aside
      className="mb-5 border-3 border-border-low bg-accent p-4"
      aria-label="Repository starter guide"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl text-gold">Start contributing</h3>
        <a
          className="underline hover:text-gold"
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Browse repository ↗
        </a>
      </div>
      <p className="mt-1 text-muted">
        Read the setup and contribution instructions before starting your quest.
      </p>
      {context?.available ? (
        <>
          <p className="mt-2 text-neon">
            Grounded in {context.files.length} real file paths and{" "}
            {context.code_samples.length} code excerpts · revision{" "}
            {context.revision.slice(0, 7)}
          </p>
          {context.truncated && (
            <p className="text-gold">
              Partial snapshot: some repository files were omitted.
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {guides.map((doc) => (
              <details
                key={doc.path}
                className="border-2 border-border-low p-3"
              >
                <summary className="cursor-pointer">Preview {doc.path}</summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-muted">
                  {doc.excerpt.slice(0, 1200)}
                  {doc.excerpt.length > 1200 ? "…" : ""}
                </p>
                <a
                  href={fileUrl(repo, context, doc.path)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block underline text-neon"
                >
                  {doc.path}
                </a>
              </details>
            ))}
          </div>
          {relevant.length > 0 && (
            <p className="mt-3">
              Suggested files:{" "}
              {relevant.map((path) => (
                <a
                  key={path}
                  href={fileUrl(repo, context, path)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mr-3 inline-block break-all underline text-neon"
                >
                  {path}
                </a>
              ))}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-muted">
          Repository context is unavailable for this result. File suggestions
          are unverified.
        </p>
      )}
      {context?.warning && <p className="mt-2 text-gold">{context.warning}</p>}
    </aside>
  );
}
