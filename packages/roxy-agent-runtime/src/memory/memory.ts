import type {
  ContentBlock,
  IMemoryProvider,
  Message,
  SessionId,
  TrimPolicy,
  TrimSummary,
  Trimmer,
} from "../core/interfaces.ts";
import { SlidingWindowTrimmer } from "./trimmer.ts";

// Advance from the front of `messages` until we find a `user` message that
// does NOT contain `tool_result` blocks — this is the only safe starting
// position for an Anthropic API request (assistant-first or orphaned
// tool_result both produce 400 errors). Never removes the last message.
function advanceToSafeBoundary(messages: Message[]): Message[] {
  let i = 0;
  while (i < messages.length - 1) {
    const msg = messages[i]!;
    if (msg.role === "user" && !hasToolResultBlocks(msg)) break;
    i++;
  }
  return i === 0 ? messages : messages.slice(i);
}

function hasToolResultBlocks(msg: Message): boolean {
  if (!Array.isArray(msg.content)) return false;
  return (msg.content as ContentBlock[]).some((b) => b.type === "tool_result");
}

export interface InMemoryProviderOptions {
  trimmer?: Trimmer;
}

/** In-memory per-session history + summary store. v1 default provider. */
export class InMemoryProvider implements IMemoryProvider {
  private readonly histories = new Map<SessionId, Message[]>();
  private readonly summaries = new Map<SessionId, string>();
  private readonly trimmer: Trimmer;

  constructor(opts: InMemoryProviderOptions = {}) {
    this.trimmer = opts.trimmer ?? new SlidingWindowTrimmer();
  }

  async append(sessionId: SessionId, msg: Message): Promise<void> {
    const list = this.histories.get(sessionId);
    if (list) {
      list.push(msg);
    } else {
      this.histories.set(sessionId, [msg]);
    }
  }

  async getAll(sessionId: SessionId): Promise<Message[]> {
    return [...(this.histories.get(sessionId) ?? [])];
  }

  async getSince(sessionId: SessionId, count: number): Promise<Message[]> {
    const all = this.histories.get(sessionId) ?? [];
    return all.slice(-count);
  }

  async trim(sessionId: SessionId, policy: TrimPolicy): Promise<TrimSummary> {
    const messages = this.histories.get(sessionId) ?? [];
    const { kept, summary } = this.trimmer.trim(messages, policy);
    // Ensure the trimmed history never starts with an assistant message or an
    // orphaned tool_result block — both cause Anthropic 400 errors.
    this.histories.set(sessionId, advanceToSafeBoundary(kept));
    return summary;
  }

  async setSummary(sessionId: SessionId, summary: string): Promise<void> {
    this.summaries.set(sessionId, summary);
  }

  async getSummary(sessionId: SessionId): Promise<string | null> {
    return this.summaries.get(sessionId) ?? null;
  }

  async prependMessage(sessionId: SessionId, msg: Message): Promise<void> {
    const list = this.histories.get(sessionId);
    if (list) {
      list.unshift(msg);
    } else {
      this.histories.set(sessionId, [msg]);
    }
  }

  async clear(sessionId: SessionId): Promise<void> {
    this.histories.delete(sessionId);
    this.summaries.delete(sessionId);
  }
}
