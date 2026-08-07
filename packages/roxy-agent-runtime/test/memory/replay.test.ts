import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonlSessionStore } from "../../src/memory/session_store.ts";
import { InMemoryProvider } from "../../src/memory/memory.ts";
import { replayIntoMemory } from "../../src/memory/replay.ts";
import type { Message, RolloutEvent } from "../../src/core/interfaces.ts";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "roxy-test-replay-"));
}

async function writeRollout(store: JsonlSessionStore, sessionId: string, events: RolloutEvent[]) {
  for (const e of events) await store.append(sessionId, e);
}

describe("replayIntoMemory", () => {
  it("returns empty / isNew for an unknown session", async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() });
    const memory = new InMemoryProvider();
    const res = await replayIntoMemory(store, memory, "ghost");
    expect(res.eventCount).toBe(0);
    expect(res.isNew).toBe(true);
    expect(await memory.getAll("ghost")).toEqual([]);
  });

  it("replays user + assistant turns back into memory in order", async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() });
    const memory = new InMemoryProvider();
    const sid = "s1";
    const events: RolloutEvent[] = [
      { type: "session_start", sessionId: sid, createdAt: 1 },
      { type: "user_input", message: { role: "user", content: "hi" } },
      {
        type: "assistant_turn",
        message: { role: "assistant", content: "hello" },
        stopReason: "end_turn",
      },
      { type: "user_input", message: { role: "user", content: "again" } },
      {
        type: "assistant_turn",
        message: { role: "assistant", content: "bye" },
        stopReason: "end_turn",
      },
    ];
    await writeRollout(store, sid, events);

    const res = await replayIntoMemory(store, memory, sid);
    expect(res.eventCount).toBe(5);
    expect(res.isNew).toBe(false);

    const history: Message[] = await memory.getAll(sid);
    expect(history.map((m) => m.content)).toEqual(["hi", "hello", "again", "bye"]);
  });

  it("preserves thinking blocks and tool_result blocks on replay", async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() });
    const memory = new InMemoryProvider();
    const sid = "s2";
    const events: RolloutEvent[] = [
      { type: "session_start", sessionId: sid, createdAt: 1 },
      { type: "user_input", message: { role: "user", content: "use tool" } },
      {
        type: "assistant_turn",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "plan", signature: "sig_T" },
            { type: "tool_use", id: "tu1", name: "echo", input: { x: 1 } },
          ],
        },
        stopReason: "tool_use",
      },
      {
        type: "tool_result",
        result: { type: "tool_result", tool_use_id: "tu1", content: "ok" },
      },
      {
        type: "assistant_turn",
        message: { role: "assistant", content: "done" },
        stopReason: "end_turn",
      },
    ];
    await writeRollout(store, sid, events);

    await replayIntoMemory(store, memory, sid);
    const history: Message[] = await memory.getAll(sid);

    // user, assistant(thinking+tool_use), user(tool_result), assistant
    expect(history).toHaveLength(4);
    expect(history[1]!.content).toEqual([
      { type: "thinking", thinking: "plan", signature: "sig_T" } as never,
      { type: "tool_use", id: "tu1", name: "echo", input: { x: 1 } } as never,
    ]);
    expect(history[2]!.content).toEqual([{ type: "tool_result", tool_use_id: "tu1", content: "ok" } as never]);
  });

  it("ignores session_start (metadata only)", async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() });
    const memory = new InMemoryProvider();
    const sid = "s3";
    await writeRollout(store, sid, [{ type: "session_start", sessionId: sid, createdAt: 7 }]);
    await replayIntoMemory(store, memory, sid);
    // session_start contributes no message but counts as an event.
    expect(await memory.getAll(sid)).toEqual([]);
  });
});
