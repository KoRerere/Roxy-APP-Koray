import { describe, expect, it } from "vitest";
import type { Message, TrimPolicy } from "../../src/core/interfaces.ts";
import { MiniTrimmer } from "../helpers/miniTrimmer.ts";

/**
 * CONTRACT tests for the sliding-window trimmer. Production impl
 * (src/memory/trimmer.ts) MUST satisfy these.
 */

// 16-char content → ~4 tokens each (ceil(16/4))
const msgs = (roles: Message["role"][]): Message[] => roles.map((role) => ({ role, content: `${role}-message-xxxx` }));

describe("trimmer contract — turns mode", () => {
  it("keeps the last N messages, archives the head", () => {
    const tr = new MiniTrimmer();
    const { kept, summary } = tr.trim(msgs(["user", "assistant", "user", "assistant"]), {
      mode: "turns",
      keep: 2,
    } satisfies TrimPolicy);
    expect(kept.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(summary.removedCount).toBe(2);
    expect(summary.archivedText).toBe("user: user-message-xxxx\nassistant: assistant-message-xxxx");
  });

  it("never drops the most recent message even when keep < 1", () => {
    const tr = new MiniTrimmer();
    const { kept } = tr.trim(msgs(["user", "assistant"]), {
      mode: "turns",
      keep: 0,
    } satisfies TrimPolicy);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.role).toBe("assistant");
  });

  it("archives nothing when within budget", () => {
    const tr = new MiniTrimmer();
    const { summary } = tr.trim(msgs(["user"]), { mode: "turns", keep: 5 });
    expect(summary.removedCount).toBe(0);
    expect(summary.archivedText).toBe("");
  });
});

describe("trimmer contract — tokens mode", () => {
  // content "user-message-xxxx" (16 chars) ≈ 4 tokens
  it("keeps a tail within the token budget, archiving the older head", () => {
    const tr = new MiniTrimmer();
    const { kept, summary } = tr.trim(msgs(["user", "assistant", "user", "assistant"]), {
      mode: "tokens",
      keep: 4,
    } satisfies TrimPolicy);
    // budget 4 fits at most one message → keep only the latest
    expect(kept).toHaveLength(1);
    expect(kept[0]?.role).toBe("assistant");
    // the archived head is everything that was removed
    expect(summary.removedCount).toBe(3);
    expect(summary.archivedText.startsWith("user:")).toBe(true);
  });

  it("always keeps the most recent message regardless of budget", () => {
    const tr = new MiniTrimmer();
    const { kept } = tr.trim(msgs(["user", "assistant"]), {
      mode: "tokens",
      keep: 0,
    } satisfies TrimPolicy);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.role).toBe("assistant");
  });

  it("kept tail tokens never exceed the budget (except the required latest)", () => {
    const tr = new MiniTrimmer();
    const { kept } = tr.trim(msgs(["user", "assistant", "user", "assistant"]), {
      mode: "tokens",
      keep: 4,
    } satisfies TrimPolicy);
    // only the required latest message is kept (4 tokens), nothing more
    expect(kept).toHaveLength(1);
  });

  it("empty history trims to empty", () => {
    const tr = new MiniTrimmer();
    const { kept, summary } = tr.trim([], { mode: "tokens", keep: 10 });
    expect(kept).toEqual([]);
    expect(summary.removedCount).toBe(0);
    expect(summary.archivedText).toBe("");
  });
});
