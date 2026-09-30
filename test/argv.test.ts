import { describe, expect, it } from "vitest";
import { splitCommandLine } from "../src/argv.js";

describe("splitCommandLine", () => {
  it.each([
    ["node server.js", ["node", "server.js"]],
    ["  npx  -y  pkg  ", ["npx", "-y", "pkg"]],
    [`python -c 'print("a b")'`, ["python", "-c", 'print("a b")']],
    [`echo "say \\"hi\\"" end`, ["echo", 'say "hi"', "end"]],
    ["a\\ b c", ["a b", "c"]],
    [`''`, [""]],
    ["", []],
  ])("splits %j", (line, words) => {
    expect(splitCommandLine(line)).toEqual(words);
  });

  it("rejects unterminated quotes", () => {
    expect(() => splitCommandLine(`node "server.js`)).toThrow(/unterminated/);
  });
});
