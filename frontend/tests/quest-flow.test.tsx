import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Home from "../app/page";
import { fetchRecommendations } from "../app/lib/api";
import {
  emptyLibrary,
  updateLibrary,
  type SavedQuest,
} from "../app/lib/quest-library";

vi.mock("../app/components/bounty/payout-panel", () => ({
  PayoutPanel: ({ repo }: { repo: string }) => (
    <div data-testid="payout-panel">Payout for {repo}</div>
  ),
}));
vi.mock("../app/components/bounty/ledger", () => ({
  Ledger: () => <div>Ledger</div>,
}));
vi.mock("../app/lib/api", async (original) => ({
  ...(await original<typeof import("../app/lib/api")>()),
  fetchRecommendations: vi.fn(),
}));

const saved: SavedQuest = {
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
const KEY = "bountybridge:quests:v1";
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

test("accepted quest and checked steps survive a page remount, then drop relocks payout", async () => {
  let state = updateLibrary(emptyLibrary(), { type: "accept", quest: saved });
  state = updateLibrary(state, {
    type: "step",
    key: "o/r#7",
    step: "Read parser",
    checked: true,
  });
  localStorage.setItem(KEY, JSON.stringify(state));
  const view = render(<Home />);
  expect(await screen.findByText(/Restored saved quest/)).toBeTruthy();
  expect(
    (screen.getByRole("checkbox", { name: "Read parser" }) as HTMLInputElement)
      .checked
  ).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Run tests" }));
  view.unmount();
  render(<Home />);
  expect(
    (
      (await screen.findByRole("checkbox", {
        name: "Run tests",
      })) as HTMLInputElement
    ).checked
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /Drop quest/ }));
  expect(screen.queryByTestId("payout-panel")).toBeNull();
  expect(screen.getByRole("region", { name: "Saved quests" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Resume quest" }));
  expect(screen.getByTestId("payout-panel")).toBeTruthy();
});

test("a new search clears accepted selection and stops loading feedback when it fails", async () => {
  localStorage.setItem(
    KEY,
    JSON.stringify(
      updateLibrary(emptyLibrary(), { type: "accept", quest: saved })
    )
  );
  let reject!: (reason: Error) => void;
  vi.mocked(fetchRecommendations).mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      })
  );
  render(<Home />);
  fireEvent.change(screen.getByLabelText("GitHub repo"), {
    target: { value: "other/project" },
  });
  fireEvent.click(screen.getByRole("button", { name: /find quests/ }));
  expect(screen.queryByTestId("payout-panel")).toBeNull();
  expect(screen.getByText(/0s elapsed/)).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Resume quest" }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  reject(new Error("Test backend unavailable"));
  await screen.findByText(/Test backend unavailable/);
  expect(screen.queryByText(/elapsed/)).toBeNull();
  expect(screen.getByRole("button", { name: "Resume quest" })).toBeTruthy();
});

test("corrupt storage does not prevent a fresh successful search", async () => {
  localStorage.setItem(KEY, "broken JSON");
  vi.mocked(fetchRecommendations).mockResolvedValue({
    data: {
      repo: "o/r",
      provider: "fake",
      attempts: 1,
      labels_used: [],
      recommendations: [saved.rec],
    },
    replayed: false,
  });
  render(<Home />);
  fireEvent.change(screen.getByLabelText("GitHub repo"), {
    target: { value: "o/r" },
  });
  fireEvent.click(screen.getByRole("button", { name: /find quests/ }));
  await screen.findByText("Fix parser");
  fireEvent.click(screen.getByRole("button", { name: /Save quest/ }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(KEY)!).saved).toHaveLength(1)
  );
  fireEvent.click(screen.getByRole("button", { name: "Accept quest" }));
  expect(screen.getByTestId("payout-panel")).toBeTruthy();
});
