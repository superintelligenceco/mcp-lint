import type { Finding, Severity } from "../types.js";
import { VERSION } from "../version.js";
import {
  countsSummary,
  describeTarget,
  inventory,
  passed,
  type ReportContext,
  serverLabel,
} from "./common.js";

const CODES = { red: 31, yellow: 33, blue: 34, green: 32, bold: 1, dim: 2 } as const;
type Style = keyof typeof CODES;

export function formatText(ctx: ReportContext, color = false): string {
  const paint = (style: Style, s: string) => (color ? `\x1b[${CODES[style]}m${s}\x1b[0m` : s);
  const sevStyle: Record<Severity, Style> = { error: "red", warning: "yellow", info: "blue" };
  const { result } = ctx;
  const lines: string[] = [];

  const label = serverLabel(result.snapshot);
  lines.push(
    paint("bold", `mcp-lint ${VERSION}`) +
      (label ? `  ${label}` : "") +
      paint("dim", `  (${inventory(result.snapshot)})`),
    "",
  );

  const groups = new Map<string, Finding[]>();
  for (const f of result.findings) {
    const k = describeTarget(f.target);
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const ruleWidth = Math.max(0, ...result.findings.map((f) => f.ruleId.length));
  for (const [target, findings] of groups) {
    lines.push(paint("bold", target));
    for (const f of findings) {
      const sev = paint(sevStyle[f.severity], f.severity.padEnd(7));
      lines.push(`  ${sev}  ${paint("dim", f.ruleId.padEnd(ruleWidth))}  ${f.message}`);
    }
    lines.push("");
  }
  if (result.findings.length === 0) lines.push(paint("green", "No problems found."), "");

  const gradeStyle: Style = result.score >= 80 ? "green" : result.score >= 60 ? "yellow" : "red";
  lines.push(
    `${paint("bold", "Score")} ${paint(gradeStyle, `${result.score}/100`)}  ` +
      `${paint("bold", "Grade")} ${paint(gradeStyle, result.grade)}  ` +
      paint("dim", `(${countsSummary(result)})`),
  );
  lines.push(
    passed(ctx)
      ? paint("green", `Passed: score is at or above the minimum of ${ctx.minScore}.`)
      : paint("red", `Failed: score is below the minimum of ${ctx.minScore}.`),
  );
  return `${lines.join("\n")}\n`;
}
