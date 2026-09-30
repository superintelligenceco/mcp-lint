import { readFileSync } from "node:fs";
import { isObject } from "./rules/helpers.js";
import { HIDDEN_CHARS } from "./rules/injection.js";
import type { Snapshot } from "./types.js";

export class SnapshotError extends Error {}

function list<T>(value: unknown, field: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new SnapshotError(`"${field}" must be an array`);
  return value as T[];
}

/**
 * Normalizes the shapes people usually save: a bare array of tools, a
 * `tools/list` result, a full JSON-RPC response, or a snapshot written by
 * `mcp-lint --save`.
 */
export function parseSnapshot(raw: unknown): Snapshot {
  let data = raw;
  if (isObject(data) && isObject(data.result) && "jsonrpc" in data) data = data.result;
  if (Array.isArray(data)) data = { tools: data };
  if (!isObject(data)) throw new SnapshotError("expected a JSON object or an array of tools");
  if (
    data.tools === undefined &&
    data.prompts === undefined &&
    data.resources === undefined &&
    data.resourceTemplates === undefined
  ) {
    throw new SnapshotError('no "tools", "prompts", or "resources" found');
  }
  const snapshot: Snapshot = {
    tools: list(data.tools, "tools"),
    resources: list(data.resources, "resources"),
    resourceTemplates: list(data.resourceTemplates, "resourceTemplates"),
    prompts: list(data.prompts, "prompts"),
  };
  snapshot.tools.forEach((tool, i) => {
    if (!isObject(tool)) throw new SnapshotError(`tools[${i}] is not an object`);
    if (typeof tool.name !== "string") throw new SnapshotError(`tools[${i}] has no string "name"`);
  });
  if (isObject(data.server)) snapshot.server = data.server as Snapshot["server"];
  if (typeof data.instructions === "string") snapshot.instructions = data.instructions;
  return snapshot;
}

export function readSnapshotFile(path: string): { snapshot: Snapshot; text: string } {
  const text = readFileSync(path, "utf8");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new SnapshotError(`${path}: ${(error as Error).message}`);
  }
  try {
    return { snapshot: parseSnapshot(raw), text };
  } catch (error) {
    throw new SnapshotError(`${path}: ${(error as Error).message}`);
  }
}

/**
 * Serializes a snapshot as pretty JSON with invisible characters written as
 * `\u` escapes, so a saved file shows in review exactly what a model reads.
 */
export function serializeSnapshot(snapshot: Snapshot): string {
  const json = JSON.stringify(snapshot, null, 2).replace(HIDDEN_CHARS, (ch) =>
    [...ch]
      .flatMap((c) => {
        const cp = c.codePointAt(0) ?? 0;
        if (cp <= 0xffff) return [cp];
        const v = cp - 0x10000;
        return [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)];
      })
      .map((unit) => `\\u${unit.toString(16).padStart(4, "0")}`)
      .join(""),
  );
  return `${json}\n`;
}
