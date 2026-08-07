import { describe, expect, it, vi } from "vitest";
import { SuspendingClarificationHandler } from "../../src/clarification/handler.ts";
import type { PendingClarification } from "../../src/core/interfaces.ts";

describe("SuspendingClarificationHandler", () => {
  it("parks until the pending's resume is called, then resolves with the answer", async () => {
    const handler = new SuspendingClarificationHandler();
    let captured: PendingClarification | undefined;
    handler.onPending = (p) => {
      captured = p;
    };

    const promise = handler.request({ traceId: "t1", question: "Which color?" });
    expect(captured).toBeDefined();
    expect(captured!.request.question).toBe("Which color?");
    expect(captured!.traceId).toBe("t1");

    captured!.resume({ answer: "blue" });
    await expect(promise).resolves.toEqual({ answer: "blue" });
  });

  it("auto-resolves with an empty answer after the request's timeoutMs", async () => {
    vi.useFakeTimers();
    try {
      const handler = new SuspendingClarificationHandler();
      handler.onPending = () => {
        /* user never answers */
      };
      const promise = handler.request({ traceId: "t1", question: "q", timeoutMs: 5_000 });
      vi.advanceTimersByTime(5_000);
      await expect(promise).resolves.toEqual({ answer: "" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the constructor default timeout when the request has none", async () => {
    vi.useFakeTimers();
    try {
      const handler = new SuspendingClarificationHandler({ timeoutMs: 1_000 });
      handler.onPending = () => {
        /* parked */
      };
      const promise = handler.request({ traceId: "t1", question: "q" });
      vi.advanceTimersByTime(1_000);
      await expect(promise).resolves.toEqual({ answer: "" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("resume after timeout (or double resume) is a safe no-op", async () => {
    vi.useFakeTimers();
    try {
      const handler = new SuspendingClarificationHandler();
      let captured: PendingClarification | undefined;
      handler.onPending = (p) => {
        captured = p;
      };
      const promise = handler.request({ traceId: "t1", question: "q", timeoutMs: 100 });
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toEqual({ answer: "" });
      expect(() => captured!.resume({ answer: "late" })).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("with no listener wired, resolves immediately with an empty answer (fail-safe)", async () => {
    const handler = new SuspendingClarificationHandler();
    await expect(handler.request({ traceId: "t1", question: "q" })).resolves.toEqual({ answer: "" });
  });
});
