#!/usr/bin/env node
// A tiny MCP server used by the integration tests and the examples.
//
//   node server.mjs [clean|messy]                 stdio transport
//   node server.mjs [clean|messy] --http <port>   Streamable HTTP on 127.0.0.1
import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { clean, messy } from "./definitions.mjs";

const mode = process.argv[2] === "clean" ? "clean" : "messy";
const defs = mode === "clean" ? clean : messy;

function build() {
  const server = new Server(
    { name: `fixture-${mode}`, version: "1.0.0" },
    { capabilities: { tools: {}, prompts: {}, resources: {} } },
  );
  // Serve tools one page at a time so clients have to follow nextCursor.
  server.setRequestHandler(ListToolsRequestSchema, (req) => {
    const start = Number(req.params?.cursor ?? 0);
    const next = start + 2;
    return {
      tools: defs.tools.slice(start, next),
      ...(next < defs.tools.length ? { nextCursor: String(next) } : {}),
    };
  });
  server.setRequestHandler(ListPromptsRequestSchema, () => ({ prompts: defs.prompts }));
  server.setRequestHandler(ListResourcesRequestSchema, () => ({ resources: defs.resources }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({ resourceTemplates: [] }));
  return server;
}

const httpFlag = process.argv.indexOf("--http");
if (httpFlag === -1) {
  await build().connect(new StdioServerTransport());
} else {
  const port = Number(process.argv[httpFlag + 1] ?? 0);
  const http = createServer(async (req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    const server = build();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });
  http.listen(port, "127.0.0.1", () => {
    // The test harness reads the chosen port from this line.
    process.stdout.write(`listening ${http.address().port}\n`);
  });
}
