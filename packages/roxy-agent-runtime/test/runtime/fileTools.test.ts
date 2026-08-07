import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTestAgent, chatResponse } from "../helpers/buildTestAgent.ts";

function tmpFile() {
  const dir = mkdtempSync(join(tmpdir(), "roxy-filetools-"));
  const path = join(dir, "target.txt");
  writeFileSync(path, "the answer is 42");
  return { path, dir };
}

describe("file tools registered on the agent", () => {
  it("the agent can read_file a path it is instructed to check", async () => {
    const { path } = tmpFile();
    let n = 0;
    const { agent } = buildTestAgent({
      handler: () => {
        n++;
        if (n === 1)
          return chatResponse(
            { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "read_file", input: { path } }] },
            "tool_use",
          );
        return chatResponse({ role: "assistant", content: "done" }, "end_turn");
      },
    });

    const events = [];
    for await (const e of agent.stream("read the file")) events.push(e);
    const types = events.map((e) => e.type);

    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types.at(-1)).toBe("done");
    // The tool_result carries the file content back to the model.
    const tr = events.find((e) => e.type === "tool_result") as { result?: { content: string } };
    expect(tr?.result?.content).toContain("the answer is 42");
  });
});
