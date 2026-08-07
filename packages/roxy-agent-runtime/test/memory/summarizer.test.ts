import { describe, expect, it } from "vitest";
import { BackgroundSummarizer } from "../../src/memory/summarizer.ts";
import { FakeProvider } from "../../src/provider/fake.ts";

describe("BackgroundSummarizer", () => {
  it("uses the host-provided output budget for providers with extended thinking", async () => {
    // Regression: the fixed 1024-token budget could be smaller than a provider's
    // thinking budget, causing the compaction request to fail before summarizing.
    // Fixed by: let the host choose a maxTokens value compatible with its provider.
    const provider = new FakeProvider({
      responses: [
        {
          message: { role: "assistant", content: "<summary>Retained context</summary>" },
          stopReason: "end_turn",
          usage: { inputTokens: 100, outputTokens: 20 },
        },
      ],
    });
    const summarizer = new BackgroundSummarizer(provider, "fake-model", { maxTokens: 8192 });

    await expect(summarizer.summarize("user: prior context")).resolves.toContain("Retained context");
    expect(provider.calls[0]?.maxTokens).toBe(8192);
  });
});
