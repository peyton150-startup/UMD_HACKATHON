import { describe, expect, test } from "vitest";
import {
  buildBountyMemo,
  isPullRequestUrl,
  parseBountyMemo,
} from "../app/lib/memo";

const record = {
  repo: "owner/repo",
  issueNumber: 12,
  prUrl: "https://github.com/owner/repo/pull/45",
};

describe("bounty memo", () => {
  test("round-trips through the RPC's '[len] text' format", () => {
    const memo = buildBountyMemo(record);
    expect(parseBountyMemo(`[${memo.length}] ${memo}`)).toEqual(record);
  });

  test("finds our memo among several joined with '; '", () => {
    const memo = buildBountyMemo(record);
    expect(parseBountyMemo(`[2] gm; [${memo.length}] ${memo}`)).toEqual(record);
  });

  test("ignores unrelated memos", () => {
    expect(parseBountyMemo("[5] hello")).toBeNull();
    expect(parseBountyMemo(null)).toBeNull();
  });

  test("accepts only GitHub pull request links", () => {
    expect(isPullRequestUrl(record.prUrl)).toBe(true);
    expect(isPullRequestUrl("https://github.com/owner/repo/issues/12")).toBe(false);
    expect(isPullRequestUrl("https://evil.com/owner/repo/pull/1")).toBe(false);
  });
});
