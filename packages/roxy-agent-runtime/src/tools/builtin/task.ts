import type { BuiltinTool } from "./index.ts";
import type { ISubAgentDispatcher, Message, SubAgentSpec } from "../../core/interfaces.ts";

export interface TaskToolDeps {
  dispatcher: ISubAgentDispatcher;
  /** The available subagent specs — advertised in the tool description. */
  specs: SubAgentSpec[];
}

/** Extract the last assistant text from a subagent's response messages. */
function lastAssistantText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "assistant") continue;
    if (typeof m.content === "string") {
      if (m.content.length > 0) return m.content;
      continue;
    }
    const text = m.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (text.length > 0) return text;
  }
  return "";
}

/**
 * The `task` tool — the main agent's handle for delegating a subtask to a named
 * subagent (which may run on a different model vendor). It reports the
 * subagent's final message back as the tool result, keeping the parent's active
 * context lean (the subagent's own turn-by-turn history stays in its isolated
 * session).
 *
 * Honors the framework's never-reject convention: an unknown subagent, a bad
 * input, or a failing/aborted child all surface as `isError` results, never a
 * thrown error across the loop boundary. Marked `sensitive` so HITL can gate
 * delegation in strict/delegate modes.
 */
export function taskTool(deps: TaskToolDeps): BuiltinTool {
  const names = deps.specs.map((s) => s.name);
  const menu = deps.specs.map((s) => `- ${s.name}: ${s.description}`).join("\n");

  return {
    descriptor: {
      name: "task",
      description:
        "Delegate a subtask to a specialised subagent and get its final report back. " +
        "Available subagents:\n" +
        menu,
      inputSchema: {
        type: "object",
        properties: {
          subagent_type: {
            type: "string",
            enum: names,
            description: "Which subagent to dispatch to.",
          },
          description: {
            type: "string",
            description: "The self-contained task for the subagent to perform.",
          },
        },
        required: ["subagent_type", "description"],
      },
      source: "builtin",
      metadata: { sensitive: true },
    },
    handler: async (input, ctx) => {
      const raw = input as Record<string, unknown>;
      const type = raw?.subagent_type;
      const description = raw?.description;
      if (typeof type !== "string" || type.length === 0) {
        return { content: "task: 'subagent_type' is required", isError: true };
      }
      if (typeof description !== "string" || description.length === 0) {
        return { content: "task: 'description' is required", isError: true };
      }
      if (!names.includes(type)) {
        return {
          content: `task: unknown subagent '${type}'. Available: ${names.join(", ")}`,
          isError: true,
        };
      }
      try {
        const resp = await deps.dispatcher.run(type, description, ctx.signal);
        const report = lastAssistantText(resp.messages);
        return {
          content: report.length > 0 ? report : "(subagent produced no textual report)",
          isError: false,
        };
      } catch (err) {
        return {
          content: `task: subagent '${type}' failed: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        };
      }
    },
  };
}
