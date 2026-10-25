import { expect, test } from "vitest";
import { parseRepoScope } from "../app/lib/api";

test.each([
  ["microsoft", { owner: "microsoft" }],
  ["microsoft/", { owner: "microsoft" }],
  [" microsoft/auto ", { owner: "microsoft", name: "auto" }],
  ["https://github.com/microsoft/autogen", { owner: "microsoft", name: "autogen" }],
  ["https://github.com/microsoft/autogen.git", { owner: "microsoft", name: "autogen" }],
])("parseRepoScope(%j)", (input, expected) => {
  expect(parseRepoScope(input)).toEqual(expected);
});

test("empty box means no scope", () => {
  expect(parseRepoScope("   ")).toBeNull();
  expect(parseRepoScope("/x")).toBeNull();
});
