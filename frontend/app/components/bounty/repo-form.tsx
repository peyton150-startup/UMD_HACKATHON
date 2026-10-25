"use client";

import { useState } from "react";
import type { DeveloperProfile, Experience } from "../../lib/api";

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

  const langList = languages
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const canSubmit = repo.trim() !== "" && langList.length > 0 && !loading;

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
      <label className="sm:col-span-2">
        <span className="text-muted">GitHub repo</span>
        <input
          className="pixel-input mt-1"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="owner/name or https://github.com/owner/name"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
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
