import type { AgentResponse, ISubAgentManager, Message, SubAgentOptions } from "../core/interfaces.ts";

type SubAgentFactory = (task: string, idx?: number) => Promise<AgentResponse>;

/**
 * Delegates subtasks to sibling subagents via an injected factory.
 *
 * - parallel: `Promise.all` over `count` concurrent factory invocations.
 * - sequential: each stage's output becomes the next stage's input text;
 *   the number of pipeline stages is given as the second constructor argument.
 */
export class SubAgentManager implements ISubAgentManager {
  private readonly factory: SubAgentFactory;
  private readonly stages: number;

  constructor(factory: SubAgentFactory, stages = 1) {
    this.factory = factory;
    this.stages = stages;
  }

  async delegate(task: string, options: SubAgentOptions): Promise<AgentResponse[]> {
    if (options.mode === "parallel") {
      return Promise.all(Array.from({ length: options.count }, (_, idx) => this.factory(task, idx)));
    }

    // sequential: chain stages, feeding each response as the next task
    const results: AgentResponse[] = [];
    let currentTask = task;
    for (let i = 0; i < this.stages; i++) {
      const response = await this.factory(currentTask, i);
      results.push(response);
      // Extract the last assistant message content as next stage input
      const lastMsg: Message | undefined = response.messages[response.messages.length - 1];
      if (lastMsg) {
        currentTask =
          typeof lastMsg.content === "string"
            ? lastMsg.content
            : (lastMsg.content as Array<{ type: string; text?: string }>)
                .filter((b) => b.type === "text")
                .map((b) => b.text ?? "")
                .join("");
      }
    }
    return results;
  }
}
