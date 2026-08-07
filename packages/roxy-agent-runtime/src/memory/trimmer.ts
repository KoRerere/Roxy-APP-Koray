import type { Message, TrimPolicy, Trimmer, TrimSummary } from "../core/interfaces.ts";

function toText(m: Message): string {
  if (typeof m.content === "string") return m.content;
  return JSON.stringify(m.content);
}

function defaultCountTokens(messages: Message[]): number {
  return messages.reduce((n, m) => n + Math.ceil(toText(m).length / 4), 0);
}

/**
 * Sliding-window trimmer. Keeps the latest N turns (turns mode) or stays
 * under a token budget (tokens mode). Always preserves the most recent message.
 */
export class SlidingWindowTrimmer implements Trimmer {
  private readonly countTokens: (messages: Message[]) => number;

  constructor(countTokens?: (messages: Message[]) => number) {
    this.countTokens = countTokens ?? defaultCountTokens;
  }

  trim(messages: Message[], policy: TrimPolicy): { kept: Message[]; summary: TrimSummary } {
    if (messages.length === 0) {
      return { kept: [], summary: { removedCount: 0, removedTokens: 0, archivedText: "" } };
    }

    let cut: number;
    if (policy.mode === "turns") {
      cut = Math.max(0, messages.length - policy.keep);
    } else {
      let tokens = 0;
      let keptFrom = messages.length;
      for (let i = messages.length - 1; i >= 0; i--) {
        const t = this.countTokens([messages[i]!]);
        if (i < messages.length - 1 && tokens + t > policy.keep) break;
        tokens += t;
        keptFrom = i;
      }
      cut = keptFrom;
    }

    // always preserve the most recent message
    if (cut >= messages.length) cut = messages.length - 1;

    const removed = messages.slice(0, cut);
    const kept = messages.slice(cut);
    const archivedText = removed.map((m) => `${m.role}: ${toText(m)}`).join("\n");
    const summary: TrimSummary = {
      removedCount: removed.length,
      removedTokens: this.countTokens(removed),
      archivedText,
    };
    return { kept, summary };
  }
}
