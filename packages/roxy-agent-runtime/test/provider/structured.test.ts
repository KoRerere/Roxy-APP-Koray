import { describe, expect, it } from "vitest";
import { z } from "zod";
import { NotImplementedError } from "../../src/core/errors.ts";
import { FakeProvider } from "../../src/provider/fake.ts";
import { endTurnResponse, toolCallResponse, userMsg } from "../helpers/makeFakeProvider.ts";

describe("FakeProvider.withStructuredOutput", () => {
  it("forces a single extract tool and returns the parsed zod value", async () => {
    const provider = new FakeProvider({
      responses: [toolCallResponse("t1", "extract", { x: 1, name: "nyx" })],
    });
    const schema = z.object({ x: z.number(), name: z.string() });

    const extract = provider.withStructuredOutput(schema);
    const parsed = await extract("describe the thing");

    expect(parsed).toEqual({ x: 1, name: "nyx" });

    // The underlying chat call forced the synthetic extract tool.
    const req = provider.calls[0];
    expect(req.toolChoice).toEqual({ type: "tool", name: "extract" });
    expect(req.tools?.[0]?.name).toBe("extract");
    expect(req.messages).toEqual([userMsg("describe the thing")]);
  });

  it("honors a custom extract tool name", async () => {
    const provider = new FakeProvider({
      responses: [toolCallResponse("t1", "get_person", { age: 42 })],
    });
    const extract = provider.withStructuredOutput(z.object({ age: z.number() }), { name: "get_person" });
    const parsed = await extract("hi");
    expect(parsed).toEqual({ age: 42 });
    expect(provider.calls[0].toolChoice).toEqual({
      type: "tool",
      name: "get_person",
    });
  });

  it("returns { raw, parsed } when includeRaw is true", async () => {
    const scripted = toolCallResponse("t1", "extract", { ok: true });
    const provider = new FakeProvider({ responses: [scripted] });
    const extract = provider.withStructuredOutput(z.object({ ok: z.boolean() }), { includeRaw: true });
    const out = await extract("hi");
    expect(out).toEqual({ raw: scripted.message, parsed: { ok: true } });
  });

  it("throws when the scripted response never calls the tool", async () => {
    const provider = new FakeProvider({
      responses: [endTurnResponse("just text, no tool")],
    });
    const extract = provider.withStructuredOutput(z.object({ ok: z.boolean() }));
    await expect(extract("hi")).rejects.toThrow(/did not call tool 'extract'/);
  });

  it("throws (zod) when the scripted tool input violates the schema", async () => {
    const provider = new FakeProvider({
      responses: [toolCallResponse("t1", "extract", { x: "not a number" })],
    });
    const extract = provider.withStructuredOutput(z.object({ x: z.number() }));
    await expect(extract("hi")).rejects.toThrow();
  });

  it("rejects unsupported methods up front", () => {
    const provider = new FakeProvider();
    expect(() =>
      provider.withStructuredOutput(z.object({ x: z.number() }), {
        method: "jsonMode",
      }),
    ).toThrow(NotImplementedError);
  });
});
