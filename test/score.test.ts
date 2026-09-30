import { describe, expect, it } from "vitest";
import { lint } from "../src/lint.js";
import { computeScore, gradeFor, INJECTION_CAP } from "../src/score.js";
import type { Finding } from "../src/types.js";
import { goodTool, snap } from "./helpers.js";

const finding = (name: string, severity: Finding["severity"], ruleId = "x/y"): Finding => ({
  ruleId,
  severity,
  message: "m",
  target: { kind: name === "server" ? "server" : "tool", name },
});

describe("gradeFor", () => {
  it.each([
    [100, "A"],
    [90, "A"],
    [89, "B"],
    [80, "B"],
    [70, "C"],
    [60, "D"],
    [59, "F"],
    [0, "F"],
  ])("maps %i to %s", (score, grade) => {
    expect(gradeFor(score)).toBe(grade);
  });
});

describe("computeScore", () => {
  const s = snap({ tools: [goodTool({ name: "a" }), goodTool({ name: "b" })] });

  it("gives 100 with no findings and for an empty server", () => {
    expect(computeScore(s, []).score).toBe(100);
    expect(computeScore(snap({}), []).score).toBe(100);
  });

  it("averages entity scores", () => {
    // a: 100 - 25 - 8 = 67, b: 100 -> mean 83.5 -> 84
    const { score, entities } = computeScore(s, [finding("a", "error"), finding("a", "warning")]);
    expect(score).toBe(84);
    expect(entities.find((e) => e.name === "a")?.score).toBe(67);
  });

  it("floors an entity at zero", () => {
    const many = Array.from({ length: 10 }, () => finding("a", "error"));
    expect(computeScore(s, many).entities.find((e) => e.name === "a")?.score).toBe(0);
  });

  it("subtracts server-level findings from the total", () => {
    expect(computeScore(s, [finding("server", "info")]).score).toBe(98);
  });

  it("caps the score when any injection error exists", () => {
    const big = snap({ tools: Array.from({ length: 20 }, (_, i) => goodTool({ name: `t${i}` })) });
    const { score } = computeScore(big, [
      { ...finding("t0", "error"), ruleId: "injection/hidden-unicode" },
    ]);
    expect(score).toBe(INJECTION_CAP);
  });
});

describe("lint", () => {
  it("applies config overrides, off switches, and ignoreTools", () => {
    const tools = [
      goodTool({ description: "Short one." }),
      goodTool({ name: "legacy", description: "x" }),
    ];
    const base = lint(snap({ tools }));
    expect(base.findings.some((f) => f.target.name === "legacy")).toBe(true);

    const tuned = lint(snap({ tools }), {
      rules: { "description/too-short": "error", "description/vague": "off" },
      minScore: 70,
      ignoreTools: ["legacy"],
      options: { descriptionMinLength: 20, descriptionMaxLength: 1024 },
    });
    expect(tuned.findings.map((f) => [f.ruleId, f.severity, f.target.name])).toEqual([
      ["description/too-short", "error", "search_docs"],
    ]);
    expect(tuned.counts).toEqual({ error: 1, warning: 0, info: 0 });
  });
});
