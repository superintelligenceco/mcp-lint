import { lint } from "../src/lint.js";
import type { Config, Finding, Snapshot, Tool } from "../src/types.js";

export function snap(partial: Partial<Snapshot>): Snapshot {
  return { tools: [], resources: [], resourceTemplates: [], prompts: [], ...partial };
}

export const GOOD_SCHEMA = {
  type: "object",
  properties: { q: { type: "string", description: "Search query text." } },
  required: ["q"],
};

/** A tool that passes every rule, for building one-problem variations. */
export function goodTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: "search_docs",
    description: "Searches the product documentation and returns matching page titles.",
    inputSchema: GOOD_SCHEMA,
    annotations: { readOnlyHint: true },
    ...overrides,
  };
}

export function findingsFor(snapshot: Snapshot, ruleId: string, config?: Config): Finding[] {
  return lint(snapshot, config).findings.filter((f) => f.ruleId === ruleId);
}

export function ruleIds(snapshot: Snapshot): string[] {
  return [...new Set(lint(snapshot).findings.map((f) => f.ruleId))].sort();
}
