import { Ajv } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Rule } from "../types.js";
import { isObject, walkProperties } from "./helpers.js";

const DRAFT_07 = "http://json-schema.org/draft-07/schema";

const ajv2020 = new Ajv2020({ strict: false, validateFormats: false, allErrors: true });
const ajv07 = new Ajv({ strict: false, validateFormats: false, allErrors: true });

/**
 * Returns a human-readable reason when `schema` is not a valid JSON Schema, or
 * `undefined` when it is. MCP defaults to JSON Schema 2020-12 and servers
 * frequently emit draft-07, so the `$schema` keyword picks the dialect.
 */
export function schemaProblem(schema: unknown): string | undefined {
  if (!isObject(schema)) return "inputSchema is not an object";
  const dialect = typeof schema.$schema === "string" ? schema.$schema : "";
  const ajv = dialect.startsWith(DRAFT_07) ? ajv07 : ajv2020;
  const copy = { ...schema };
  delete copy.$schema;
  if (!ajv.validateSchema(copy)) {
    const first = ajv.errors?.[0];
    const where = first?.instancePath ? ` at ${first.instancePath}` : "";
    return `schema does not validate against the JSON Schema meta-schema${where}: ${first?.message ?? "unknown error"}`;
  }
  try {
    ajv.compile(copy);
  } catch (error) {
    return `schema does not compile: ${(error as Error).message}`;
  }
  return undefined;
}

const TYPE_KEYWORDS = ["type", "enum", "const", "$ref", "anyOf", "oneOf", "allOf", "not"];

export const schemaRules: Rule[] = [
  {
    id: "schema/missing-input-schema",
    category: "schema",
    defaultSeverity: "error",
    summary: "Every tool declares an inputSchema, as the MCP specification requires.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        if (tool.inputSchema === undefined) {
          ctx.report({
            target: { kind: "tool", name: tool.name },
            message: "Tool has no inputSchema. Declare one, even if it is an empty object schema.",
          });
        }
      }
    },
  },
  {
    id: "schema/invalid-input-schema",
    category: "schema",
    defaultSeverity: "error",
    summary: "inputSchema is a valid JSON Schema whose root type is object.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        if (tool.inputSchema === undefined) continue;
        const problem = schemaProblem(tool.inputSchema);
        if (problem) {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "inputSchema" },
            message: `Invalid inputSchema: ${problem}.`,
          });
          continue;
        }
        if (tool.inputSchema.type !== "object") {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "inputSchema.type" },
            message: `inputSchema root type must be "object", got ${JSON.stringify(tool.inputSchema.type ?? null)}.`,
          });
        }
      }
    },
  },
  {
    id: "schema/invalid-output-schema",
    category: "schema",
    defaultSeverity: "error",
    summary: "outputSchema, when present, is a valid JSON Schema.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        if (tool.outputSchema === undefined) continue;
        const problem = schemaProblem(tool.outputSchema);
        if (problem) {
          ctx.report({
            target: { kind: "tool", name: tool.name, path: "outputSchema" },
            message: `Invalid outputSchema: ${problem}.`,
          });
        }
      }
    },
  },
  {
    id: "schema/missing-param-description",
    category: "schema",
    defaultSeverity: "warning",
    summary: "Every parameter has a description the model can read.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        for (const prop of walkProperties(tool.inputSchema)) {
          const desc = prop.schema.description;
          if (typeof desc !== "string" || desc.trim() === "") {
            ctx.report({
              target: { kind: "tool", name: tool.name, path: prop.path },
              message: `Parameter "${prop.name}" has no description.`,
            });
          }
        }
      }
    },
  },
  {
    id: "schema/untyped-param",
    category: "schema",
    defaultSeverity: "warning",
    summary: "Every parameter declares a type, enum, const, or composition keyword.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        for (const prop of walkProperties(tool.inputSchema)) {
          if (!TYPE_KEYWORDS.some((k) => k in prop.schema)) {
            ctx.report({
              target: { kind: "tool", name: tool.name, path: prop.path },
              message: `Parameter "${prop.name}" has no type, so any JSON value is accepted.`,
            });
          }
        }
      }
    },
  },
  {
    id: "schema/unknown-required",
    category: "schema",
    defaultSeverity: "error",
    summary: "Every name in `required` exists in `properties`.",
    check(ctx) {
      for (const tool of ctx.snapshot.tools) {
        const schema = tool.inputSchema;
        if (!isObject(schema) || !Array.isArray(schema.required)) continue;
        const props = isObject(schema.properties) ? schema.properties : {};
        if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
          continue;
        }
        for (const name of schema.required) {
          if (typeof name === "string" && !(name in props)) {
            ctx.report({
              target: { kind: "tool", name: tool.name, path: "inputSchema.required" },
              message: `"${name}" is listed as required but is not defined in properties.`,
            });
          }
        }
      }
    },
  },
];
