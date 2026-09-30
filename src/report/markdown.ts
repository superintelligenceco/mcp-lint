import {
  countsSummary,
  describeTarget,
  inventory,
  passed,
  type ReportContext,
  serverLabel,
} from "./common.js";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** A compact report for pull request comments and GitHub Actions job summaries. */
export function formatMarkdown(ctx: ReportContext): string {
  const { result } = ctx;
  const label = serverLabel(result.snapshot);
  const status = passed(ctx) ? "passed" : "failed";
  const lines = [
    `### mcp-lint: grade ${result.grade} (${result.score}/100)`,
    "",
    `${label ? `\`${label}\`, ` : ""}${inventory(result.snapshot)}. ` +
      `${countsSummary(result)}. ` +
      `Minimum score ${ctx.minScore}: **${status}**.`,
    "",
  ];
  if (result.findings.length > 0) {
    lines.push("| Severity | Target | Rule | Message |", "| --- | --- | --- | --- |");
    for (const f of result.findings) {
      lines.push(
        `| ${f.severity} | ${cell(describeTarget(f.target))} | \`${f.ruleId}\` | ${cell(f.message)} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
