import type { IClarificationHandler } from "../../core/interfaces.ts";
import type { BuiltinTool } from "./index.ts";

/** Model-initiated user clarification tool. */
export function ask_userTool(clarificationHandler: IClarificationHandler): BuiltinTool {
  return {
    descriptor: {
      name: "ask_user",
      description: "Ask the user a clarifying question and wait for their reply.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string", description: "One concrete question to ask the user." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Optional finite set of choices. User must pick one.",
          },
          timeoutMs: { type: "number", description: "Auto-resolve with empty string after this many milliseconds." },
        },
        required: ["question"],
      },
      source: "builtin",
      metadata: { sensitive: false },
    },
    handler: async (input, _ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.question !== "string" || raw.question.length === 0) {
        return { content: "ask_user: 'question' is required and must be a non-empty string", isError: true };
      }
      const req = {
        traceId: _ctx.traceId,
        question: raw.question as string,
        ...(Array.isArray(raw.options) ? { options: raw.options as string[] } : {}),
        ...(typeof raw.timeoutMs === "number" ? { timeoutMs: raw.timeoutMs as number } : {}),
      };
      const result = await clarificationHandler.request(req);
      return { content: result.answer, isError: false };
    },
  };
}
