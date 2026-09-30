import { createHash } from "node:crypto";
import { rules } from "../rules/index.js";
import type { Finding, Severity } from "../types.js";
import { VERSION } from "../version.js";
import type { ReportContext } from "./common.js";

const INFO_URI = "https://github.com/superintelligenceco/mcp-lint";
const LEVEL: Record<Severity, "error" | "warning" | "note"> = {
  error: "error",
  warning: "warning",
  info: "note",
};

export interface SarifOptions {
  /** Path, relative to the repository root, that results point at. */
  artifactUri: string;
  /** Contents of the artifact, used to find the line that defines each entity. */
  artifactText?: string;
}

/** Finds the 1-based line where an entity is defined in a saved snapshot. */
export function findLine(text: string | undefined, finding: Finding): number {
  if (!text) return 1;
  const key =
    finding.target.kind === "resource"
      ? "uri"
      : finding.target.kind === "resourceTemplate"
        ? "uriTemplate"
        : "name";
  const needle = new RegExp(
    `"${key}"\\s*:\\s*${escapeRegExp(JSON.stringify(finding.target.name))}`,
  );
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => needle.test(line));
  return index === -1 ? 1 : index + 1;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anchor(ruleId: string): string {
  return ruleId.replace(/[^a-z0-9-]/g, "");
}

export function toSarif(ctx: ReportContext, options: SarifOptions) {
  const ruleIndex = new Map(rules.map((r, i) => [r.id, i]));
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "mcp-lint",
            version: VERSION,
            semanticVersion: VERSION,
            informationUri: INFO_URI,
            rules: rules.map((r) => ({
              id: r.id,
              name: r.id.replace(/[/-](\w)/g, (_, c: string) => c.toUpperCase()),
              shortDescription: { text: r.summary },
              helpUri: `${INFO_URI}#${anchor(r.id)}`,
              defaultConfiguration: { level: LEVEL[r.defaultSeverity] },
              properties: { tags: ["mcp", r.category] },
            })),
          },
        },
        results: ctx.result.findings.map((f) => {
          const qualified = [f.target.kind, f.target.name, f.target.path].filter(Boolean).join("/");
          return {
            ruleId: f.ruleId,
            ruleIndex: ruleIndex.get(f.ruleId) ?? -1,
            level: LEVEL[f.severity],
            message: { text: `${f.target.kind} "${f.target.name}": ${f.message}` },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: options.artifactUri },
                  region: { startLine: findLine(options.artifactText, f) },
                },
                logicalLocations: [{ fullyQualifiedName: qualified, kind: "member" }],
              },
            ],
            partialFingerprints: {
              "mcpLint/v1": createHash("sha256").update(`${f.ruleId}|${qualified}`).digest("hex"),
            },
          };
        }),
      },
    ],
  };
}

export function formatSarif(ctx: ReportContext, options: SarifOptions): string {
  return `${JSON.stringify(toSarif(ctx, options), null, 2)}\n`;
}
