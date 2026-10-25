import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useQuestLibrary } from "../app/lib/hooks/use-quest-library";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Library() {
  const { library, dispatch } = useQuestLibrary();
  return (
    <>
      <p>Saved count: {library.saved.length}</p>
      <button
        onClick={() =>
          dispatch({
            type: "save",
            quest: {
              repo: "o/r",
              savedAt: "2026-10-25T12:00:00Z",
              rec: {
                issue: {
                  number: 7,
                  title: "Fix parser",
                  url: "https://github.com/o/r/issues/7",
                  body: "",
                  labels: [],
                },
                fit_score: 80,
                rationale: "fits",
                steps: ["Run tests"],
                files_to_look_at: [],
              },
            },
          })
        }
      >
        Save
      </button>
    </>
  );
}

test("blocked browser storage falls back to working session-only saves", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Quota");
  });
  const view = render(<Library />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByText("Saved count: 1")).toBeTruthy();
  view.unmount();
  render(<Library />);
  expect(screen.getByText("Saved count: 1")).toBeTruthy();
});
