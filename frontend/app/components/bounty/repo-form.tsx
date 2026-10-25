"use client";

import { useState } from "react";
import {
  discoverRepos,
  parseRepoScope,
  type RepoScope,
  type DeveloperProfile,
  type Experience,
  type RepoSuggestion,
} from "../../lib/api";

type Props = {
  loading: boolean;
  onSubmit: (repo: string, profile: DeveloperProfile, labels: string[]) => void;
};

const EXPERIENCE: Experience[] = ["beginner", "intermediate", "advanced"];

export function RepoForm({ loading, onSubmit }: Props) {
  const [repo, setRepo] = useState("");
  const [languages, setLanguages] = useState("python");
  const [experience, setExperience] = useState<Experience>("beginner");
  const [hours, setHours] = useState(4);
  const [labels, setLabels] = useState("good first issue");

  const [picks, setPicks] = useState<RepoSuggestion[] | null>(null);
  const [pickScope, setPickScope] = useState<RepoScope | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const langList = languages
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const canSubmit = repo.trim() !== "" && langList.length > 0 && !loading;

  async function handleDiscover() {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      // a full "owner/repo" means the user already chose; search that owner instead
      const scope = parseRepoScope(repo);
      setPicks((await discoverRepos(langList, scope)).repos);
      setPickScope(scope);
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(
          repo.trim(),
          { languages: langList, experience, hours_available: hours },
          labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean)
        );
      }}
    >
      <div className="sm:col-span-2">
        <label htmlFor="repo-input" className="text-muted">
          GitHub repo
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="repo-input"
            className="pixel-input"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/name or https://github.com/owner/name"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discovering || langList.length === 0}
            className="pixel-btn shrink-0 bg-gold text-black"
          >
            {discovering ? "Scanning..." : "★ Find repos for me"}
          </button>
        </div>

        {discoverError && (
          <p className="mt-2 text-destructive" role="alert">
            ! {discoverError}
          </p>
        )}

        {picks && (
          <div className="mt-3">
            <p className="text-muted">
              {pickScope
                ? picks.length > 0
                  ? `Active ${pickScope.owner} repos${pickScope.name ? ` matching "${pickScope.name}"` : ""} in ${langList.join(", ")} with 3+ open good first issues:`
                  : `No active ${pickScope.owner} repos${pickScope.name ? ` matching "${pickScope.name}"` : ""} in ${langList.join(", ")} with 3+ open good first issues. Try another language, or clear the repo box for Hacktoberfest picks.`
                : picks.length > 0
                  ? `Active Hacktoberfest repos in ${langList.join(", ")} with 3+ open good first issues:`
                  : `No matching Hacktoberfest repos for ${langList.join(", ")}. Try another language.`}
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {picks.map((p) => {
                const chosen = repo.trim().toLowerCase() === p.full_name.toLowerCase();
                return (
                  <li key={p.full_name}>
                    <button
                      type="button"
                      onClick={() => setRepo(p.full_name)}
                      aria-pressed={chosen}
                      className={`h-full w-full border-3 p-2 text-left transition-colors ${
                        chosen
                          ? "border-gold bg-accent"
                          : "border-border-low hover:border-border hover:bg-accent"
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="break-all text-foreground">{p.full_name}</span>
                        <span className="shrink-0 text-gold">★ {p.stars.toLocaleString()}</span>
                      </span>
                      <span className="block text-muted">
                        {p.language ?? "?"}
                        {p.description && ` · ${p.description}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <label>
        <span className="text-muted">Your languages (comma separated)</span>
        <input
          className="pixel-input mt-1"
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
        />
      </label>
      <label>
        <span className="text-muted">Issue labels</span>
        <input
          className="pixel-input mt-1"
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
        />
      </label>
      <fieldset>
        <legend className="text-muted">Experience</legend>
        <div className="mt-1 flex gap-2">
          {EXPERIENCE.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setExperience(lvl)}
              aria-pressed={experience === lvl}
              className={`flex-1 border-3 px-2 py-1 uppercase ${
                experience === lvl
                  ? "border-gold bg-gold text-black"
                  : "border-border-low hover:border-border"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        <span className="text-muted">Hours available: {hours}</span>
        <input
          type="range"
          min={1}
          max={20}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--gold)]"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="pixel-btn w-full bg-primary text-primary-foreground"
        >
          {loading ? "Loading level..." : "▶ Insert coin · find quests"}
        </button>
      </div>
    </form>
  );
}
