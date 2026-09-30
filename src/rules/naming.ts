import type { Rule } from "../types.js";

/** Tool name format from the MCP specification (2025-11-25): 1-128 of A-Z a-z 0-9 _ - . */
const TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

type Style = "snake_case" | "camelCase" | "kebab-case" | "dot.case" | "PascalCase";

export function nameStyle(name: string): Style | undefined {
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(name)) return "snake_case";
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(name)) return "kebab-case";
  if (/^[a-z0-9]+(\.[a-z0-9]+)+$/.test(name)) return "dot.case";
  if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(name)) return "camelCase";
  if (/^([A-Z][a-z0-9]+){2,}$/.test(name)) return "PascalCase";
  return undefined;
}

export const namingRules: Rule[] = [
  {
    id: "naming/invalid-tool-name",
    category: "naming",
    defaultSeverity: "error",
    summary:
      "Tool names use only A-Z, a-z, 0-9, underscore, hyphen, and dot, and are 1-128 characters long.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        if (typeof tool.name !== "string" || !TOOL_NAME.test(tool.name)) {
          ctx.report({
            target: { kind: "tool", name: String(tool.name) },
            message: `Tool name ${JSON.stringify(tool.name)} does not match ${TOOL_NAME.source}; some clients reject or rewrite it.`,
          });
        }
      }
    },
  },
  {
    id: "naming/duplicate-name",
    category: "naming",
    defaultSeverity: "error",
    summary: "Tool names, prompt names, and resource URIs are unique.",
    check(ctx) {
      const groups = [
        { kind: "tool" as const, names: ctx.snapshot.tools.map((t) => t.name) },
        { kind: "prompt" as const, names: ctx.snapshot.prompts.map((p) => p.name) },
        { kind: "resource" as const, names: ctx.snapshot.resources.map((r) => r.uri) },
      ];
      for (const { kind, names } of groups) {
        const seen = new Set<string>();
        const reported = new Set<string>();
        for (const name of names) {
          if (seen.has(name) && !reported.has(name)) {
            reported.add(name);
            ctx.report({
              target: { kind, name },
              message: `More than one ${kind} is named "${name}"; clients will call only one of them.`,
            });
          }
          seen.add(name);
        }
      }
    },
  },
  {
    id: "naming/inconsistent-style",
    category: "naming",
    defaultSeverity: "info",
    summary: "Tool names follow one casing convention.",
    check(ctx) {
      const byStyle = new Map<Style, string[]>();
      for (const tool of ctx.snapshot.tools) {
        const style = nameStyle(tool.name);
        if (!style) continue;
        byStyle.set(style, [...(byStyle.get(style) ?? []), tool.name]);
      }
      if (byStyle.size < 2) return;
      const summary = [...byStyle.entries()]
        .map(
          ([style, names]) =>
            `${style} (${names.slice(0, 3).join(", ")}${names.length > 3 ? ", ..." : ""})`,
        )
        .join("; ");
      ctx.report({
        target: { kind: "server", name: ctx.snapshot.server?.name ?? "server" },
        message: `Tool names mix ${byStyle.size} casing styles: ${summary}.`,
      });
    },
  },
];
