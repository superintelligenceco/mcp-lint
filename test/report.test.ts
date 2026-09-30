import { describe, expect, it } from "vitest";
import { lint } from "../src/lint.js";
import { formatJson } from "../src/report/json.js";
import { formatMarkdown } from "../src/report/markdown.js";
import { findLine, toSarif } from "../src/report/sarif.js";
import { formatText } from "../src/report/text.js";
import { rules } from "../src/rules/index.js";
import { goodTool, snap } from "./helpers.js";

const snapshot = snap({
  server: { name: "demo", version: "2.0.0" },
  tools: [goodTool(), goodTool({ name: "bad|tool", description: "Short." })],
});
const ctx = { result: lint(snapshot), minScore: 70 };

describe("text report", () => {
  it("groups findings by target and prints the score", () => {
    const out = formatText(ctx);
    expect(out).toContain("demo 2.0.0");
    expect(out).toContain("tool bad|tool");
    expect(out).toMatch(/Score \d+\/100 {2}Grade [A-F]/);
    expect(out).not.toContain("\x1b[");
  });

  it("adds ANSI colors only when asked", () => {
    expect(formatText(ctx, true)).toContain("\x1b[");
  });

  it("says so when there is nothing to report", () => {
    const out = formatText({ result: lint(snap({ tools: [goodTool()] })), minScore: 70 });
    expect(out).toContain("No problems found.");
    expect(out).toContain("Passed");
    expect(out).toContain("(0 errors, 0 warnings, 0 info)");
  });

  it("uses the singular for a count of one", () => {
    const one = lint(snap({ tools: [goodTool({ description: "Too short." })] }));
    expect(one.counts.warning).toBe(1);
    expect(formatText({ result: one, minScore: 70 })).toContain("1 warning,");
    expect(formatMarkdown({ result: one, minScore: 70 })).toContain("1 warning,");
  });
});

describe("JSON report", () => {
  it("includes score, pass state, counts, and findings", () => {
    const json = JSON.parse(formatJson(ctx));
    expect(json).toMatchObject({
      tool: "mcp-lint",
      score: ctx.result.score,
      minScore: 70,
      inventory: { tools: 2 },
    });
    expect(json.passed).toBe(ctx.result.score >= 70);
    expect(json.findings.length).toBe(ctx.result.findings.length);
  });
});

describe("markdown report", () => {
  it("escapes table cells", () => {
    const md = formatMarkdown(ctx);
    expect(md).toMatch(/^### mcp-lint: grade [A-F]/);
    expect(md).toContain("tool bad\\|tool");
  });
});

describe("SARIF report", () => {
  const text = JSON.stringify(snapshot, null, 2);
  const sarif = toSarif(ctx, { artifactUri: "tools.json", artifactText: text });
  const run = sarif.runs[0];

  it("declares every rule with a help link", () => {
    expect(sarif.version).toBe("2.1.0");
    expect(run?.tool.driver.rules.map((r) => r.id)).toEqual(rules.map((r) => r.id));
    expect(run?.tool.driver.rules[0]?.helpUri).toMatch(/#schemamissing-input-schema$/);
  });

  it("points each result at the line that defines the entity", () => {
    const result = run?.results.find((r) => r.message.text.includes("bad|tool"));
    const line = result?.locations[0]?.physicalLocation.region.startLine ?? 0;
    expect(text.split("\n")[line - 1]).toContain('"name": "bad|tool"');
    expect(result?.ruleIndex).toBeGreaterThanOrEqual(0);
    expect(result?.partialFingerprints["mcpLint/v1"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("falls back to line 1 without source text", () => {
    const f = ctx.result.findings[0];
    if (!f) throw new Error("expected a finding");
    expect(findLine(undefined, f)).toBe(1);
    expect(findLine("{}", f)).toBe(1);
  });

  it("maps info to note", () => {
    const withInfo = lint(
      snap({ tools: [goodTool({ name: "get_user" }), goodTool({ name: "listUsers" })] }),
    );
    const out = toSarif({ result: withInfo, minScore: 0 }, { artifactUri: "x" });
    expect(out.runs[0]?.results.map((r) => r.level)).toContain("note");
  });
});
