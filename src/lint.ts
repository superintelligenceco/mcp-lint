import { rules } from "./rules/index.js";
import { computeScore, gradeFor } from "./score.js";
import type { Config, EntityKind, Finding, LintResult, Severity, Snapshot } from "./types.js";

export const DEFAULT_CONFIG: Config = {
  rules: {},
  minScore: 70,
  ignoreTools: [],
  options: { descriptionMinLength: 20, descriptionMaxLength: 1024 },
};

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const KIND_ORDER: Record<EntityKind, number> = {
  tool: 0,
  prompt: 1,
  resource: 2,
  resourceTemplate: 3,
  server: 4,
};

/** Runs every enabled rule over a snapshot and scores the result. */
export function lint(input: Snapshot, config: Config = DEFAULT_CONFIG): LintResult {
  const ignored = new Set(config.ignoreTools);
  const snapshot: Snapshot = { ...input, tools: input.tools.filter((t) => !ignored.has(t.name)) };
  const findings: Finding[] = [];

  for (const rule of rules) {
    const setting = config.rules[rule.id] ?? rule.defaultSeverity;
    if (setting === "off") continue;
    const override = config.rules[rule.id] !== undefined;
    rule.check({
      snapshot,
      options: config.options,
      report(f) {
        findings.push({
          ruleId: rule.id,
          // A configured severity wins; otherwise a rule may escalate or soften a single finding.
          severity: override ? setting : (f.severity ?? rule.defaultSeverity),
          message: f.message,
          target: f.target,
        });
      },
    });
  }

  // Group by entity so reports read one tool at a time, most severe first.
  findings.sort(
    (a, b) =>
      KIND_ORDER[a.target.kind] - KIND_ORDER[b.target.kind] ||
      a.target.name.localeCompare(b.target.name) ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleId.localeCompare(b.ruleId),
  );

  const { score, entities } = computeScore(snapshot, findings);
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return { snapshot, findings, score, grade: gradeFor(score), entities, counts };
}
