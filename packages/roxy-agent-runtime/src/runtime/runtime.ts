import { randomUUID } from "node:crypto";
import type { ZodType } from "zod";
import type {
  Agent,
  AgentInput,
  AgentDefinition,
  AgentResponse,
  AgentStreamEvent,
  ApprovalResult,
  ClarificationResult,
  StructuredAgent,
  StructuredOutputOptions,
  SubAgentOptions,
} from "../core/interfaces.ts";
import { replayIntoMemory } from "../memory/replay.ts";
import { AgentImpl } from "./agent.ts";
import { buildAgentGraph } from "./graph.ts";
import { assemblePlugins, mergeHooks } from "./plugin_assembler.ts";

/**
 * Public lifecycle owner for one assembled Agent session.
 *
 * Use {@link AgentRuntime.create}; setup is asynchronous because plugins and
 * durable session replay must complete before the instance can be invoked.
 */
export class AgentRuntime implements Agent {
  readonly id: string;
  readonly sessionId: string;

  private constructor(private readonly agent: AgentImpl) {
    this.id = agent.id;
    this.sessionId = agent.sessionId;
  }

  static async create(definition: AgentDefinition): Promise<AgentRuntime> {
    const sessionId = definition.sessionId ?? randomUUID();
    const agentId = definition.agentId ?? randomUUID();

    const plugins = await assemblePlugins(definition.plugins ?? [], definition.logger, definition.clarification);
    for (const tool of plugins.tools) {
      definition.tools.add(tool.descriptor, tool.handler);
    }
    const hooks = mergeHooks([...plugins.hooks, ...(definition.hooks ? [definition.hooks] : [])]);

    if (definition.sessionStore) {
      const replayed = await replayIntoMemory(definition.sessionStore, definition.memory, sessionId);
      if (replayed.isNew) {
        await definition.sessionStore.append(sessionId, {
          type: "session_start",
          sessionId,
          createdAt: Date.now(),
        });
      }
    }

    const graph = buildAgentGraph({
      model: definition.model,
      maxTokens: definition.maxTokens,
      systemPrompt: definition.systemPrompt,
      provider: definition.provider,
      tools: definition.tools,
      memory: definition.memory,
      hitl: definition.hitl,
      recorder: definition.recorder,
      logger: definition.logger,
      clarification: definition.clarification,
      hooks,
      contributors: [...(definition.contributors ?? []), ...plugins.contributors],
      middleware: [...(definition.middleware ?? []), ...plugins.middleware],
      memoryLifecycles: plugins.memoryLifecycles,
      trimPolicy: definition.trimPolicy,
      summarizer: definition.summarizer,
      contextWindowTokens: definition.contextWindowTokens,
      triggerTokens: definition.triggerTokens,
      sessionStore: definition.sessionStore,
      skills: definition.skills,
    });

    const agent = new AgentImpl(graph, {}, agentId, sessionId);
    for (const callback of plugins.disposeCallbacks) agent.addDisposeCallback(callback);
    if (definition.onDispose) agent.addDisposeCallback(definition.onDispose);
    return new AgentRuntime(agent);
  }

  invoke(input: AgentInput, signal?: AbortSignal): Promise<AgentResponse> {
    return this.agent.invoke(input, signal);
  }

  stream(input: AgentInput, signal?: AbortSignal): AsyncIterable<AgentStreamEvent> {
    return this.agent.stream(input, signal);
  }

  structured<T>(schema: ZodType<T>, options?: StructuredOutputOptions): StructuredAgent<T> {
    return this.agent.structured(schema, options);
  }

  delegate(task: string, options: SubAgentOptions): Promise<AgentResponse[]> {
    return this.agent.delegate(task, options);
  }

  resume(traceId: string, decision: ApprovalResult): void {
    this.agent.resume(traceId, decision);
  }

  clarify(traceId: string, result: ClarificationResult): void {
    this.agent.clarify(traceId, result);
  }

  cancelPending(reason?: string): void {
    this.agent.cancelPending(reason);
  }

  dispose(): Promise<void> {
    return this.agent.dispose();
  }
}
