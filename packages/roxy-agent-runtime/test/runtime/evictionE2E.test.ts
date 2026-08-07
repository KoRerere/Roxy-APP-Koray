import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTestAgent, chatResponse, endTurnResponse } from "../helpers/buildTestAgent.ts";
import { createEvictionMiddleware } from "../../src/tools/builtin/middleware/eviction.ts";
import type { AgentStreamEvent } from "../../src/core/interfaces.ts";

async function streamTurn(agent: { stream(input: string): AsyncIterable<AgentStreamEvent> }, input: string) {
  const events: AgentStreamEvent[] = [];
  for await (const e of agent.stream(input)) events.push(e);
  return events;
}

describe("eviction middleware end-to-end", () => {
  it("a tool result over the threshold is evicted to a file and the model sees a preview", async () => {
    const dir = mkdtempSync(join(tmpdir(), "evict-e2e-"));
    const bigFile = join(dir, "big.txt");
    // ~5000 chars of distinct lines → over the small maxChars we set below.
    const lines = Array.from({ length: 200 }, (_, i) => `line-number-${i}-content`);
    writeFileSync(bigFile, lines.join("\n"));

    const scratch = mkdtempSync(join(tmpdir(), "evict-scratch-"));
    const eviction = createEvictionMiddleware({ scratchDir: scratch, maxChars: 500 });

    let n = 0;
    const { agent, registry } = buildTestAgent({
      middleware: [eviction],
      handler: () => {
        n++;
        if (n === 1) {
          return chatResponse(
            {
              role: "assistant",
              content: [{ type: "tool_use", id: "tu1", name: "read_file", input: { path: bigFile, limit: 200 } }],
            },
            "tool_use",
          );
        }
        return endTurnResponse("done");
      },
    });

    const events = await streamTurn(agent, "read the big file");

    // The tool_result event carries the EVICTED preview, not the full content.
    const tr = events.find((e) => e.type === "tool_result") as
      | { type: "tool_result"; result: { content: string } }
      | undefined;
    expect(tr).toBeDefined();
    expect(tr!.result.content).toContain("too large");
    expect(tr!.result.content).toContain("Saved to");
    // Full content never reached the model-facing result.
    expect(tr!.result.content.length).toBeLessThan(5000);

    // The full tool result was persisted to the scratch file named by toolUseId.
    const file = join(scratch, "tu1.txt");
    expect(existsSync(file)).toBe(true);
    // The saved content is tool result (read_file adds line-number prefixes),
    // but it must contain every line's body.
    const saved = readFileSync(file, "utf-8");
    for (const l of lines) {
      expect(saved).toContain(l);
    }

    void registry;
  });
});
