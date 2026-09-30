import type { JsonSchema, Snapshot, Target } from "../types.js";

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface PropertyInfo {
  name: string;
  schema: JsonSchema;
  /** Dotted path from the tool root, for example `inputSchema.properties.path`. */
  path: string;
}

/**
 * Yields every named property in a schema, descending into nested objects and
 * array items so that deeply nested parameters get the same checks.
 */
export function* walkProperties(
  schema: unknown,
  path = "inputSchema",
  depth = 0,
): Generator<PropertyInfo> {
  if (!isObject(schema) || depth > 8) return;
  const props = schema.properties;
  if (isObject(props)) {
    for (const [name, child] of Object.entries(props)) {
      if (!isObject(child)) continue;
      const childPath = `${path}.properties.${name}`;
      yield { name, schema: child, path: childPath };
      yield* walkProperties(child, childPath, depth + 1);
    }
  }
  if (isObject(schema.items)) {
    yield* walkProperties(schema.items, `${path}.items`, depth + 1);
  }
}

export interface TextSurface {
  target: Target;
  field: string;
  text: string;
}

/** Every piece of free text a server sends to a model, with where it came from. */
export function* textSurfaces(snapshot: Snapshot): Generator<TextSurface> {
  const serverName = snapshot.server?.name ?? "server";
  if (snapshot.instructions) {
    yield {
      target: { kind: "server", name: serverName, path: "instructions" },
      field: "server instructions",
      text: snapshot.instructions,
    };
  }
  for (const tool of snapshot.tools) {
    for (const key of ["title", "description"] as const) {
      const text = tool[key];
      if (typeof text === "string") {
        yield { target: { kind: "tool", name: tool.name, path: key }, field: key, text };
      }
    }
    for (const prop of walkProperties(tool.inputSchema)) {
      for (const key of ["description", "title"] as const) {
        const text = prop.schema[key];
        if (typeof text === "string") {
          yield {
            target: { kind: "tool", name: tool.name, path: `${prop.path}.${key}` },
            field: `parameter "${prop.name}" ${key}`,
            text,
          };
        }
      }
    }
  }
  for (const prompt of snapshot.prompts) {
    if (typeof prompt.description === "string") {
      yield {
        target: { kind: "prompt", name: prompt.name, path: "description" },
        field: "description",
        text: prompt.description,
      };
    }
    for (const arg of prompt.arguments ?? []) {
      if (typeof arg.description === "string") {
        yield {
          target: { kind: "prompt", name: prompt.name, path: `arguments.${arg.name}.description` },
          field: `argument "${arg.name}" description`,
          text: arg.description,
        };
      }
    }
  }
  for (const resource of snapshot.resources) {
    for (const key of ["name", "description"] as const) {
      const text = resource[key];
      if (typeof text === "string") {
        yield { target: { kind: "resource", name: resource.uri, path: key }, field: key, text };
      }
    }
  }
  for (const template of snapshot.resourceTemplates) {
    for (const key of ["name", "description"] as const) {
      const text = template[key];
      if (typeof text === "string") {
        yield {
          target: { kind: "resourceTemplate", name: template.uriTemplate, path: key },
          field: key,
          text,
        };
      }
    }
  }
}

/** Splits `readFile`, `read_file`, `read-file`, and `read.file` into lowercase words. */
export function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** True when a string property restricts its values with `enum`, `const`, or `pattern`. */
export function isConstrainedString(schema: JsonSchema): boolean {
  return Array.isArray(schema.enum) || "const" in schema || typeof schema.pattern === "string";
}

export function truncate(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}
