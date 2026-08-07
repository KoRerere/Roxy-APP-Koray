import type { IModelProvider, SystemBlock, Summarizer, SystemPromptBuilder } from "../core/interfaces.ts";
import { renderSkillCatalog } from "../skills/prompt.ts";

/**
 * Default summarisation prompt, mirrored from Anthropic's official compaction
 * instructions. Wraps the summary in a `<summary>` block so downstream code
 * can extract it reliably.
 */
const DEFAULT_SUMMARY_PROMPT = `You have written a partial transcript for the initial task above.
Please write a summary of the transcript. The purpose of this summary is to
provide continuity so you can continue to make progress towards solving the
task in a future context, where the raw history above may not be accessible
and will be replaced with this summary. Write down anything that would be
helpful, including the state, next steps, learnings etc.
You must wrap your summary in a <summary></summary> block.`;

export interface BackgroundSummarizerOptions {
  instructions?: string;
  maxTokens?: number;
}

/**
 * Async summarizer. Calls the model with a summarisation prompt; the result
 * is injected into the message list as a synthetic user message (by the
 * caller — this class only produces the text).
 */
export class BackgroundSummarizer implements Summarizer {
  private readonly provider: IModelProvider;
  private readonly model: string;
  private readonly instructions?: string;
  private readonly maxTokens: number;

  constructor(provider: IModelProvider, model: string, options: BackgroundSummarizerOptions = {}) {
    this.provider = provider;
    this.model = model;
    this.instructions = options.instructions;
    this.maxTokens = options.maxTokens ?? 1024;
  }

  async summarize(archivedText: string): Promise<string> {
    const prompt = this.instructions ?? DEFAULT_SUMMARY_PROMPT;
    try {
      const response = await this.provider.chat({
        model: this.model,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nTranscript to summarize:\n\n${archivedText}`,
          },
        ],
        maxTokens: this.maxTokens,
      });
      if (typeof response.message.content === "string") return response.message.content;
      const textBlock = Array.isArray(response.message.content)
        ? response.message.content.find((b) => b.type === "text")
        : undefined;
      return textBlock && "text" in textBlock ? textBlock.text : "";
    } catch {
      return "";
    }
  }
}

/**
 * Default system-prompt assembler. Returns an ordered ARRAY of
 * {@link SystemBlock}s (not a concatenated string), most-stable-first for
 * cache hit rate: summary block (only when non-empty), base block, then
 * bounded XML skill-catalog block (only when skills are present). Pure
 * function — tested.
 *
 * Cache breakpoints (`cache_control`) are intentionally NOT set here — the
 * runtime/provider decides breakpoint placement at request time so this
 * builder stays a pure content function.
 */
export const buildSystemPrompt: SystemPromptBuilder = (base, summary, skills, skillCatalogMaxChars) => {
  const blocks: SystemBlock[] = [];
  if (summary && summary.trim() !== "") {
    blocks.push({ type: "text", text: `[Archived Context Summary: ${summary}]` });
  }
  if (base) {
    blocks.push({ type: "text", text: base });
  }
  const skillCatalog = renderSkillCatalog(skills, { maxChars: skillCatalogMaxChars });
  if (skillCatalog.text) {
    blocks.push({ type: "text", text: skillCatalog.text });
  }
  return blocks;
};
