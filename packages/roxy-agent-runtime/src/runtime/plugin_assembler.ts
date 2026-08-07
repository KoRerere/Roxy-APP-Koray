import type {
  IClarificationHandler,
  IContextContributor,
  ILogger,
  MemoryLifecycle,
  RoxyPlugin,
  ToolMiddleware,
} from "../core/interfaces.ts";
import type { AssembledPlugins } from "./plugin_api.ts";
import { PluginAPIImpl } from "./plugin_api.ts";

export type { AssembledPlugins };

/**
 * Iterate `plugins` in declaration order, call `setup(api)` on each, and
 * aggregate all registrations. Throws immediately on a duplicate plugin name.
 */
export async function assemblePlugins(
  plugins: RoxyPlugin[],
  logger: ILogger,
  clarification?: IClarificationHandler,
): Promise<AssembledPlugins> {
  const seen = new Set<string>();
  const allTools: AssembledPlugins["tools"] = [];
  const allContributors: IContextContributor[] = [];
  const allHooks: AssembledPlugins["hooks"] = [];
  const allMiddleware: ToolMiddleware[] = [];
  const allMemoryLifecycles: MemoryLifecycle[] = [];
  const allDisposeCallbacks: Array<() => void | Promise<void>> = [];

  for (const plugin of plugins) {
    if (seen.has(plugin.name)) {
      throw new Error(`AgentRuntime.create: duplicate plugin name "${plugin.name}"`);
    }
    seen.add(plugin.name);

    const childLogger = logger.child(`plugin:${plugin.name}`);
    const api = new PluginAPIImpl(childLogger, clarification);

    await plugin.setup(api);

    const { tools, contributors, hooks, middleware, memoryLifecycles, disposeCallbacks } = api.collect();
    allTools.push(...tools);
    allContributors.push(...contributors);
    allHooks.push(...hooks);
    allMiddleware.push(...middleware);
    allMemoryLifecycles.push(...memoryLifecycles);
    allDisposeCallbacks.push(...disposeCallbacks);
  }

  return {
    tools: allTools,
    contributors: allContributors,
    hooks: allHooks,
    middleware: allMiddleware,
    memoryLifecycles: allMemoryLifecycles,
    disposeCallbacks: allDisposeCallbacks,
  };
}

/**
 * Merge an array of `AgentLifecycleHooks` into a single object that multi-casts
 * each event to every registered listener. The order of hooks in `hooksList`
 * determines firing order.
 */
export function mergeHooks(
  hooksList: AssembledPlugins["hooks"],
): import("../core/interfaces.ts").AgentLifecycleHooks | undefined {
  if (hooksList.length === 0) return undefined;
  return {
    invoke: {
      before: (ctx) => hooksList.forEach((h) => h.invoke?.before?.(ctx)),
      after: (ctx) => hooksList.forEach((h) => h.invoke?.after?.(ctx)),
      abort: (ctx) => hooksList.forEach((h) => h.invoke?.abort?.(ctx)),
    },
    model: {
      before: (ctx) => hooksList.forEach((h) => h.model?.before?.(ctx)),
      firstToken: (ctx) => hooksList.forEach((h) => h.model?.firstToken?.(ctx)),
      after: (ctx) => hooksList.forEach((h) => h.model?.after?.(ctx)),
    },
    tool: {
      before: (ctx) => hooksList.forEach((h) => h.tool?.before?.(ctx)),
      after: (ctx) => hooksList.forEach((h) => h.tool?.after?.(ctx)),
    },
    subagent: {
      before: (ctx) => hooksList.forEach((h) => h.subagent?.before?.(ctx)),
      after: (ctx) => hooksList.forEach((h) => h.subagent?.after?.(ctx)),
    },
    stream: {
      chunk: (ctx) => hooksList.forEach((h) => h.stream?.chunk?.(ctx)),
    },
  };
}
