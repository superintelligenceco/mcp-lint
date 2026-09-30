import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { splitCommandLine } from "../src/argv.js";
import { lint } from "../src/lint.js";
import { computeScore, GRADE_THRESHOLDS, gradeFor, INJECTION_CAP } from "../src/score.js";
import type { Finding, Severity, Tool } from "../src/types.js";
import { goodTool, snap } from "./helpers.js";

const GRADES = GRADE_THRESHOLDS.map(([grade]) => grade);
const severity = fc.constantFrom<Severity>("error", "warning", "info");
const toolNames = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9_]{0,15}$/), {
  minLength: 1,
  maxLength: 6,
});

/** A server of clean tools plus findings aimed at those tools or at the server itself. */
const scored = toolNames.chain((names) =>
  fc.record({
    names: fc.constant(names),
    findings: fc.array(
      fc.record({
        target: fc.constantFrom(...names, "server"),
        severity,
        injection: fc.boolean(),
      }),
      { maxLength: 20 },
    ),
  }),
);

function toFindings(raw: { target: string; severity: Severity; injection: boolean }[]): Finding[] {
  return raw.map((f) => ({
    ruleId: f.injection ? "injection/instruction-phrases" : "schema/untyped-param",
    severity: f.severity,
    message: "m",
    target: { kind: f.target === "server" ? "server" : "tool", name: f.target },
  }));
}

describe("gradeFor (property)", () => {
  it("never gives a better grade to a lower score", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(GRADES.indexOf(gradeFor(lo))).toBeGreaterThanOrEqual(GRADES.indexOf(gradeFor(hi)));
      }),
    );
  });
});

describe("computeScore (property)", () => {
  it("returns an integer from 0 to 100, and 100 only without findings", () => {
    fc.assert(
      fc.property(scored, ({ names, findings }) => {
        const s = snap({ tools: names.map((name) => goodTool({ name })) });
        const { score } = computeScore(s, toFindings(findings));
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(findings.length === 0 ? 100 : 99);
      }),
    );
  });

  it("never raises the score when a finding is added", () => {
    fc.assert(
      fc.property(scored, fc.nat(), ({ names, findings }, pick) => {
        const s = snap({ tools: names.map((name) => goodTool({ name })) });
        const all = toFindings(findings);
        const fewer = all.filter((_, i) => i !== pick % Math.max(1, all.length));
        expect(computeScore(s, all).score).toBeLessThanOrEqual(computeScore(s, fewer).score);
      }),
    );
  });

  it("caps the score whenever an injection rule reports an error", () => {
    fc.assert(
      fc.property(scored, ({ names, findings }) => {
        const s = snap({ tools: names.map((name) => goodTool({ name })) });
        const all = toFindings(findings);
        const injected = all.some(
          (f) => f.severity === "error" && f.ruleId.startsWith("injection/"),
        );
        fc.pre(injected);
        expect(computeScore(s, all).score).toBeLessThanOrEqual(INJECTION_CAP);
      }),
    );
  });
});

describe("splitCommandLine (property)", () => {
  const word = fc.string({ minLength: 1, maxLength: 12 });
  const singleQuote = (w: string) => `'${w.replaceAll("'", `'\\''`)}'`;
  const doubleQuote = (w: string) => `"${w.replace(/["\\$`]/g, (c) => `\\${c}`)}"`;

  it("round-trips words quoted with single quotes", () => {
    fc.assert(
      fc.property(fc.array(word, { maxLength: 8 }), (words) => {
        expect(splitCommandLine(words.map(singleQuote).join(" "))).toEqual(words);
      }),
    );
  });

  it("round-trips words quoted with double quotes", () => {
    fc.assert(
      fc.property(fc.array(word, { maxLength: 8 }), (words) => {
        expect(splitCommandLine(words.map(doubleQuote).join("  \t"))).toEqual(words);
      }),
    );
  });

  it("splits unquoted text on whitespace like String.split", () => {
    const plain = fc.stringMatching(/^[A-Za-z0-9_./=:\- \t]{0,60}$/);
    fc.assert(
      fc.property(plain, (line) => {
        expect(splitCommandLine(line)).toEqual(line.split(/\s+/).filter(Boolean));
      }),
    );
  });
});

describe("lint (property)", () => {
  const tool: fc.Arbitrary<Tool> = fc.record(
    {
      name: fc.string({ maxLength: 40 }),
      description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
      inputSchema: fc.oneof(
        fc.constant({ type: "object" }),
        fc.record({
          type: fc.constantFrom("object", "string", "nope"),
          properties: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.record({ type: fc.constantFrom("string", "number", "bogus") }, { requiredKeys: [] }),
          ),
          required: fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 }),
        }),
      ),
    },
    { requiredKeys: ["name"] },
  ) as fc.Arbitrary<Tool>;

  it("never throws and always grades the score it returns", () => {
    fc.assert(
      fc.property(fc.array(tool, { maxLength: 6 }), (tools) => {
        const result = lint(snap({ tools }));
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.grade).toBe(gradeFor(result.score));
        expect(lint(snap({ tools })).findings).toEqual(result.findings);
      }),
      { numRuns: 200 },
    );
  });
});
