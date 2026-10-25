import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { QuestCard } from "../app/components/bounty/quest-card";
import { SearchStatus } from "../app/components/bounty/search-status";
import { StarterGuide } from "../app/components/bounty/starter-guide";
import { LoadingScreen } from "../app/components/bounty/loading-screen";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const rec = {
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
  files_to_look_at: ["src/parser.py"],
};

test("checklist reports step toggles and save is separate from accept", () => {
  const onStep = vi.fn();
  const onSave = vi.fn();
  const onSelect = vi.fn();
  render(
    <QuestCard
      rec={rec}
      rank={1}
      selected={false}
      onSelect={onSelect}
      onDrop={vi.fn()}
      saved={false}
      onSave={onSave}
      completedSteps={[]}
      onStep={onStep}
    />
  );
  fireEvent.click(screen.getByText(/Contribution checklist/));
  fireEvent.click(screen.getByRole("checkbox", { name: "Read parser" }));
  expect(onStep).toHaveBeenCalledWith("Read parser", true);
  fireEvent.click(screen.getByRole("button", { name: /Save quest/ }));
  expect(onSave).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
});

test("loading reports elapsed time honestly and cleans up its timer", () => {
  vi.useFakeTimers();
  const view = render(<SearchStatus />);
  act(() => vi.advanceTimersByTime(12000));
  expect(screen.getByText(/12s elapsed/)).toBeTruthy();
  expect(screen.getByText(/10–25 seconds/)).toBeTruthy();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("arcade loader is indeterminate rather than claiming a completion percentage", () => {
  vi.useFakeTimers();
  render(<LoadingScreen repo="o/r" />);
  act(() => vi.advanceTimersByTime(15000));
  expect(screen.queryByText(/\d+%/)).toBeNull();
  expect(screen.getByText(/15s elapsed/)).toBeTruthy();
});

test("starter guide links only to snapshot files at its pinned revision", () => {
  const revision = "a".repeat(40);
  render(
    <StarterGuide
      repo="o/r"
      context={{
        available: true,
        revision,
        files: ["README.md", "src/parser.py"],
        guides: [
          { path: "README.md", url: "https://evil.com", excerpt: "Run tests" },
        ],
        code_samples: [],
        truncated: true,
        warning: "",
      }}
      files={["src/parser.py", "invented.py"]}
    />
  );
  fireEvent.click(screen.getByText("Preview README.md"));
  expect(
    screen.getByRole("link", { name: "README.md" }).getAttribute("href")
  ).toBe(`https://github.com/o/r/blob/${revision}/README.md`);
  expect(screen.getByRole("link", { name: "src/parser.py" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "invented.py" })).toBeNull();
  expect(screen.getByText(/partial snapshot/i)).toBeTruthy();
});
