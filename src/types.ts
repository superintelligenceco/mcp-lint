/** A JSON Schema object as advertised by an MCP server. */
export type JsonSchema = Record<string, unknown>;

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  [key: string]: unknown;
}

export interface Resource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  [key: string]: unknown;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
  [key: string]: unknown;
}

/** Everything mcp-lint knows about a server, whether collected live or loaded from disk. */
export interface Snapshot {
  server?: { name?: string; version?: string };
  instructions?: string;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  prompts: Prompt[];
}

export type Severity = "error" | "warning" | "info";

export type EntityKind = "server" | "tool" | "resource" | "resourceTemplate" | "prompt";

export interface Target {
  kind: EntityKind;
  /** Tool or prompt name, resource URI, or server name. */
  name: string;
  /** Dotted path inside the entity, for example `inputSchema.properties.path`. */
  path?: string;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  target: Target;
}

export interface LintOptions {
  descriptionMinLength: number;
  descriptionMaxLength: number;
}

export interface RuleContext {
  snapshot: Snapshot;
  options: LintOptions;
  report(finding: Omit<Finding, "ruleId" | "severity"> & { severity?: Severity }): void;
}

export type RuleCategory = "schema" | "description" | "injection" | "capability" | "naming";

export interface Rule {
  id: string;
  category: RuleCategory;
  defaultSeverity: Severity;
  summary: string;
  check(ctx: RuleContext): void;
}

export type RuleSetting = Severity | "off";

export interface Config {
  rules: Record<string, RuleSetting>;
  minScore: number;
  ignoreTools: string[];
  options: LintOptions;
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface EntityScore {
  kind: EntityKind;
  name: string;
  score: number;
}

export interface LintResult {
  snapshot: Snapshot;
  findings: Finding[];
  score: number;
  grade: Grade;
  entities: EntityScore[];
  counts: Record<Severity, number>;
}
