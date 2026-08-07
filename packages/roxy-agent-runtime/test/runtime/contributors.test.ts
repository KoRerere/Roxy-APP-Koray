import { describe, expect, it } from "vitest";
import type { IContextContributor, SystemBlock } from "../../src/core/interfaces.ts";
import { buildTestAgent, endTurnResponse } from "../helpers/buildTestAgent.ts";

describe("context contributors (system blocks)", () => {
  it("contributor blocks appear after built-in blocks in ChatRequest.system", async () => {
    const capturedSystems: SystemBlock[][] = [];
    const contributor: IContextContributor = {
      async contribute() {
        return [{ type: "text", text: "from contributor" }];
      },
    };
    const { agent } = buildTestAgent({
      contributors: [contributor],
      handler: (req) => {
        capturedSystems.push(req.system ?? []);
        return endTurnResponse("ok");
      },
    });
    await agent.invoke("hello");
    const system = capturedSystems[0]!;
    // The last block should be the contributor block
    const last = system[system.length - 1];
    expect(last?.type).toBe("text");
    expect((last as { type: string; text: string }).text).toBe("from contributor");
  });

  it("multiple contributors are appended in registration order", async () => {
    const capturedSystems: SystemBlock[][] = [];
    const c1: IContextContributor = {
      async contribute() {
        return [{ type: "text", text: "contrib-1" }];
      },
    };
    const c2: IContextContributor = {
      async contribute() {
        return [{ type: "text", text: "contrib-2" }];
      },
    };
    const { agent } = buildTestAgent({
      contributors: [c1, c2],
      handler: (req) => {
        capturedSystems.push(req.system ?? []);
        return endTurnResponse("ok");
      },
    });
    await agent.invoke("hello");
    const system = capturedSystems[0]!;
    const texts = system.map((b) => (b as { type: string; text: string }).text);
    const i1 = texts.indexOf("contrib-1");
    const i2 = texts.indexOf("contrib-2");
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThanOrEqual(0);
    expect(i1).toBeLessThan(i2); // c1 before c2
  });

  it("contribute() throw is swallowed — model call continues normally", async () => {
    let callCount = 0;
    const throwingContributor: IContextContributor = {
      async contribute() {
        throw new Error("contributor failed");
      },
    };
    const { agent } = buildTestAgent({
      contributors: [throwingContributor],
      handler: (_req) => {
        callCount++;
        return endTurnResponse("ok");
      },
    });
    const result = await agent.invoke("hello");
    expect(callCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("contributor receives recentMessages window from session history", async () => {
    let receivedMessages: unknown = null;
    const capturingContributor: IContextContributor = {
      async contribute(ctx) {
        receivedMessages = ctx.recentMessages;
        return [];
      },
    };
    const { agent } = buildTestAgent({
      contributors: [capturingContributor],
      responses: [endTurnResponse("ok")],
    });
    await agent.invoke("test message");
    expect(Array.isArray(receivedMessages)).toBe(true);
  });
});
