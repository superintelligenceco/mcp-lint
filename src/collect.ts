import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import type { Prompt, Resource, ResourceTemplate, Snapshot, Tool } from "./types.js";
import { VERSION } from "./version.js";

export type ServerTarget =
  | { type: "stdio"; command: string; args: string[]; cwd?: string; env?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> };

export interface CollectOptions {
  /** Milliseconds to wait for the connection and for each list request. */
  timeout?: number;
}

export class CollectError extends Error {}

/**
 * Accepts any list result. The SDK's typed helpers such as `listTools()`
 * reject a response that breaks the spec, for example a tool with no
 * inputSchema, but reporting those breaks is the whole point of a linter.
 */
const PermissiveList = z.looseObject({ nextCursor: z.string().optional() });

async function paginate<T>(
  client: Client,
  method: "tools/list" | "prompts/list" | "resources/list" | "resources/templates/list",
  field: string,
  timeout: number,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await client.request(
      { method, params: cursor ? { cursor } : {} },
      PermissiveList,
      { timeout },
    );
    const list = (result as Record<string, unknown>)[field];
    if (Array.isArray(list)) items.push(...(list as T[]));
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  return items;
}

async function snapshotFrom(client: Client, timeout: number): Promise<Snapshot> {
  const caps = client.getServerCapabilities() ?? {};
  const snapshot: Snapshot = { tools: [], resources: [], resourceTemplates: [], prompts: [] };
  const info = client.getServerVersion();
  if (info) snapshot.server = { name: info.name, version: info.version };
  const instructions = client.getInstructions();
  if (instructions) snapshot.instructions = instructions;

  if (caps.tools) {
    snapshot.tools = await paginate<Tool>(client, "tools/list", "tools", timeout);
  }
  if (caps.prompts) {
    snapshot.prompts = await paginate<Prompt>(client, "prompts/list", "prompts", timeout);
  }
  if (caps.resources) {
    snapshot.resources = await paginate<Resource>(client, "resources/list", "resources", timeout);
    // Templates are optional; older servers answer "method not found".
    snapshot.resourceTemplates = await paginate<ResourceTemplate>(
      client,
      "resources/templates/list",
      "resourceTemplates",
      timeout,
    ).catch(() => []);
  }
  return snapshot;
}

async function withClient(transport: Transport, timeout: number): Promise<Snapshot> {
  const client = new Client({ name: "mcp-lint", version: VERSION }, { capabilities: {} });
  try {
    await client.connect(transport, { timeout });
    return await snapshotFrom(client, timeout);
  } finally {
    await client.close().catch(() => {});
  }
}

function inheritedEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") env[k] = v;
  return { ...env, ...extra };
}

/** Connects to a live server, lists everything it offers, and disconnects. */
export async function collect(
  target: ServerTarget,
  options: CollectOptions = {},
): Promise<Snapshot> {
  const timeout = options.timeout ?? 30_000;

  if (target.type === "stdio") {
    const transport = new StdioClientTransport({
      command: target.command,
      args: target.args,
      cwd: target.cwd,
      env: inheritedEnv(target.env),
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    try {
      return await withClient(transport, timeout);
    } catch (error) {
      const tail = stderr.trim() ? `\nServer stderr:\n${stderr.trim()}` : "";
      throw new CollectError(
        `Could not read from "${[target.command, ...target.args].join(" ")}": ${(error as Error).message}${tail}`,
      );
    }
  }

  const url = new URL(target.url);
  const requestInit = { headers: target.headers ?? {} };
  try {
    return await withClient(new StreamableHTTPClientTransport(url, { requestInit }), timeout);
  } catch (streamableError) {
    // Servers built before the 2025-03-26 spec revision only speak HTTP+SSE.
    try {
      return await withClient(new SSEClientTransport(url, { requestInit }), timeout);
    } catch {
      throw new CollectError(
        `Could not read from ${url.href}: ${(streamableError as Error).message}`,
      );
    }
  }
}
