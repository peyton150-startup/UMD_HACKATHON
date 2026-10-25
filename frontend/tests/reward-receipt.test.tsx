import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  RewardReceipt,
  receiptText,
  type RewardDetails,
} from "../app/components/bounty/reward-receipt";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const details: RewardDetails = {
  repo: "o/r",
  issueNumber: 7,
  issueTitle: "Fix parser",
  prUrl: "https://github.com/o/r/pull/9",
  amount: "0.05",
  maintainer: "PayerWallet",
  contributor: "ContributorWallet",
  signature: "signature123",
  explorerUrl: "https://explorer.solana.com/tx/signature123?cluster=devnet",
};
const verified = {
  ok: true,
  checks: [{ ok: true, label: "Transaction succeeded" }],
};

test("share text includes Devnet and immutable contribution and payment details", () => {
  const text = receiptText(details);
  for (const value of [
    "Devnet",
    "0.05 SOL",
    "o/r#7",
    details.prUrl,
    details.maintainer,
    details.contributor,
    details.explorerUrl,
  ])
    expect(text).toContain(value);
});

test("receipt sharing is disabled until verification succeeds", () => {
  const view = render(
    <RewardReceipt details={details} receipt={null} error={null} />
  );
  expect(
    (screen.getByRole("button", { name: "Copy receipt" }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(screen.queryByText("VERIFIED")).toBeNull();
  view.rerender(
    <RewardReceipt
      details={details}
      receipt={{ ok: false, checks: [{ ok: false, label: "Wrong recipient" }] }}
      error={null}
    />
  );
  expect(screen.getByText("MISMATCH")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Share receipt" }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
});

test("copy uses the receipt snapshot and falls back to selectable text when unavailable", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<RewardReceipt details={details} receipt={verified} error={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy receipt" }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(receiptText(details))
  );
  writeText.mockRejectedValue(new Error("Denied"));
  fireEvent.click(screen.getByRole("button", { name: "Copy receipt" }));
  expect(
    (
      (await screen.findByRole("textbox", {
        name: "Receipt text",
      })) as HTMLTextAreaElement
    ).value
  ).toBe(receiptText(details));
});

test("native share cancellation does not report a failure", async () => {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: vi
      .fn()
      .mockRejectedValue(new DOMException("Cancelled", "AbortError")),
  });
  render(<RewardReceipt details={details} receipt={verified} error={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Share receipt" }));
  await waitFor(() => expect(navigator.share).toHaveBeenCalledOnce());
  expect(screen.queryByRole("textbox")).toBeNull();
});
