import { describe, expect, it } from "vitest";
import { ask_userTool } from "../../../src/tools/builtin/ask_user.ts";
import type {
  IClarificationHandler,
  ClarificationRequest,
  ClarificationResult,
  ToolContext,
} from "../../../src/core/interfaces.ts";

function ctx(): ToolContext {
  return { agentId: "a", traceId: "t1", signal: new AbortController().signal };
}

class AutoHandler implements IClarificationHandler {
  readonly received: ClarificationRequest[] = [];
  constructor(private readonly answer: string = "yes") {}
  request(req: ClarificationRequest): Promise<ClarificationResult> {
    this.received.push(req);
    return Promise.resolve({ answer: this.answer });
  }
}

describe("ask_user tool", () => {
  it("has descriptor with name 'ask_user', builtin source, not sensitive", () => {
    const { descriptor } = ask_userTool(new AutoHandler());
    expect(descriptor.name).toBe("ask_user");
    expect(descriptor.source).toBe("builtin");
    expect(descriptor.metadata?.sensitive).toBeFalsy();
  });

  it("returns the clarification handler's answer as content", async () => {
    const handler = new AutoHandler("use TypeScript");
    const { handler: toolHandler } = ask_userTool(handler);
    const result = await toolHandler({ question: "which language?" }, ctx());
    expect(result.isError).toBe(false);
    expect(result.content).toContain("use TypeScript");
  });

  it("passes question to the clarification handler", async () => {
    const handler = new AutoHandler();
    const { handler: toolHandler } = ask_userTool(handler);
    await toolHandler({ question: "what is the project name?" }, ctx());
    expect(handler.received[0]?.question).toBe("what is the project name?");
  });

  it("passes options array to the clarification handler when provided", async () => {
    const handler = new AutoHandler("option-a");
    const { handler: toolHandler } = ask_userTool(handler);
    await toolHandler({ question: "pick one", options: ["option-a", "option-b"] }, ctx());
    expect(handler.received[0]?.options).toEqual(["option-a", "option-b"]);
  });

  it("returns isError when question is missing", async () => {
    const { handler: toolHandler } = ask_userTool(new AutoHandler());
    const result = await toolHandler({}, ctx());
    expect(result.isError).toBe(true);
  });

  it("auto-resolves with empty string when handler returns empty answer", async () => {
    const handler = new AutoHandler("");
    const { handler: toolHandler } = ask_userTool(handler);
    const result = await toolHandler({ question: "anything?" }, ctx());
    expect(result.isError).toBe(false);
    // empty answer is valid — model is expected to handle it
    expect(typeof result.content).toBe("string");
  });
});
