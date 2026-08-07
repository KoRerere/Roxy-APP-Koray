import { NotImplementedError } from "../core/errors.ts";

/**
 * Sequential pipeline subgraph (output of subagent N feeds N+1 as a user
 * message) and parallel fan-out/fan-in (Send to N subgraph instances + join
 * node). Built on the runtime's own orchestration layer. SKELETON STUB.
 */
export function buildSequentialPipeline(): unknown {
  throw new NotImplementedError("buildSequentialPipeline");
}

export function buildParallelFanOut(_count: number): unknown {
  throw new NotImplementedError("buildParallelFanOut");
}
