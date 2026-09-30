import { describe, expect, it } from "vitest";
import { parseSnapshot, SnapshotError, serializeSnapshot } from "../src/snapshot.js";

const tool = { name: "t", inputSchema: { type: "object" } };

describe("parseSnapshot", () => {
  it("accepts a bare array of tools", () => {
    expect(parseSnapshot([tool]).tools).toEqual([tool]);
  });

  it("accepts a tools/list result", () => {
    expect(parseSnapshot({ tools: [tool], nextCursor: "2" }).tools).toHaveLength(1);
  });

  it("accepts a JSON-RPC response", () => {
    expect(parseSnapshot({ jsonrpc: "2.0", id: 1, result: { tools: [tool] } }).tools).toHaveLength(
      1,
    );
  });

  it("accepts a full snapshot", () => {
    const s = parseSnapshot({
      server: { name: "s", version: "1" },
      instructions: "hi",
      tools: [tool],
      prompts: [{ name: "p" }],
      resources: [{ uri: "a://b" }],
      resourceTemplates: [],
    });
    expect(s.server?.name).toBe("s");
    expect(s.instructions).toBe("hi");
    expect(s.prompts).toHaveLength(1);
  });

  it.each([
    ["a string", "tools"],
    [{ foo: 1 }, /no "tools"/],
    [{ tools: {} }, /must be an array/],
    [{ tools: [1] }, /not an object/],
    [{ tools: [{}] }, /no string "name"/],
  ])("rejects %j", (raw, message) => {
    expect(() => parseSnapshot(raw)).toThrow(SnapshotError);
    if (message instanceof RegExp) expect(() => parseSnapshot(raw)).toThrow(message);
  });
});

describe("serializeSnapshot", () => {
  it("escapes invisible characters and round-trips", () => {
    const hidden = `a${String.fromCodePoint(0x200b)}b${String.fromCodePoint(0xe0041)}`;
    const snapshot = parseSnapshot({ tools: [{ name: "t", description: hidden }] });
    const text = serializeSnapshot(snapshot);
    expect(text).toContain("a\\u200bb\\udb40\\udc41");
    expect(text.includes(String.fromCodePoint(0x200b))).toBe(false);
    expect(parseSnapshot(JSON.parse(text)).tools[0]?.description).toBe(hidden);
  });
});
