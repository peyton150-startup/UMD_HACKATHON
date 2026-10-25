import { describe, expect, test } from "vitest";
import {
  emptyLibrary,
  parseLibrary,
  updateLibrary,
  questKey,
} from "../app/lib/quest-library";
import type { SavedQuest } from "../app/lib/quest-library";

const quest: SavedQuest = {
  repo: "o/r",
  savedAt: "2026-10-25T12:00:00Z",
  rec: {
    issue: {
      number: 7,
      title: "Fix parser",
      body: "",
      labels: [],
      url: "https://github.com/o/r/issues/7",
    },
    fit_score: 80,
    rationale: "fits",
    steps: ["Read parser", "Run tests"],
    files_to_look_at: [],
  },
};

describe("quest library", () => {
  test("GitHub canonical repository casing does not erase the saved library", () => {
    const mixedCase = { ...quest, repo: "O/r" };
    const state = updateLibrary(emptyLibrary(), {
      type: "accept",
      quest: mixedCase,
    });
    expect(parseLibrary(JSON.stringify(state)).saved).toHaveLength(1);
    expect(parseLibrary(JSON.stringify(state)).active).toBe("o/r#7");
  });
  test("restores an accepted quest and its checklist after serialization", () => {
    let state = updateLibrary(emptyLibrary(), { type: "accept", quest });
    state = updateLibrary(state, {
      type: "step",
      key: questKey(quest),
      step: "Read parser",
      checked: true,
    });
    const restored = parseLibrary(JSON.stringify(state));
    expect(restored.active).toBe("o/r#7");
    expect(restored.saved[0].rec.issue.number).toBe(7);
    expect(restored.progress["o/r#7"]).toEqual(["Read parser"]);
    expect(JSON.stringify(restored)).not.toMatch(/approved|signature|wallet/);
  });
  test("drop keeps the bookmark; remove clears active selection", () => {
    const accepted = updateLibrary(emptyLibrary(), { type: "accept", quest });
    const dropped = updateLibrary(accepted, { type: "drop" });
    expect(dropped.active).toBeNull();
    expect(dropped.saved).toHaveLength(1);
    expect(
      updateLibrary(accepted, { type: "remove", key: "o/r#7" }).active
    ).toBeNull();
  });
  test("progress is isolated by repo and old step text never checks a new step", () => {
    const state = updateLibrary(emptyLibrary(), {
      type: "step",
      key: "o/r#7",
      step: "Old instruction",
      checked: true,
    });
    expect(state.progress["other/r#7"]).toBeUndefined();
    expect(state.progress["o/r#7"].includes("Run tests")).toBe(false);
  });
  test("corrupt, unknown-version and unsafe stored data are ignored", () => {
    for (const raw of [
      "{",
      "null",
      '{"version":99}',
      JSON.stringify({ version: 1, saved: [null] }),
      JSON.stringify({
        version: 1,
        saved: [{ ...quest, repo: "https://evil.com" }],
        active: "x",
        progress: {},
      }),
    ]) {
      expect(parseLibrary(raw)).toEqual(emptyLibrary());
    }
  });
  test("saving twice updates rather than duplicates, with a bounded library", () => {
    let state = emptyLibrary();
    for (let n = 1; n <= 25; n++)
      state = updateLibrary(state, {
        type: "save",
        quest: {
          ...quest,
          rec: { ...quest.rec, issue: { ...quest.rec.issue, number: n } },
        },
      });
    state = updateLibrary(state, { type: "save", quest: state.saved[0] });
    expect(state.saved).toHaveLength(20);
  });
  test("a full library keeps twenty entries and preserves the accepted quest", () => {
    let state = emptyLibrary();
    for (let n = 1; n <= 20; n++)
      state = updateLibrary(state, {
        type: "save",
        quest: {
          ...quest,
          rec: { ...quest.rec, issue: { ...quest.rec.issue, number: n } },
        },
      });
    state = updateLibrary(state, { type: "accept", quest: state.saved[0] });
    state = updateLibrary(state, {
      type: "save",
      quest: {
        ...quest,
        rec: { ...quest.rec, issue: { ...quest.rec.issue, number: 21 } },
      },
    });
    expect(state.saved).toHaveLength(20);
    expect(state.saved.some((q) => questKey(q) === state.active)).toBe(true);
  });
});
