import { END, START, StateGraph } from '@langchain/langgraph'
import { getCheckpointSaver } from './checkpoint'
import { orchestrator, routerOrchestrator } from './orchestrator'
import { simpleNode } from './simple'
import { AgentState } from './state'
import { worker } from './worker'

// Orchestrator Graph Builder (复杂模式)
const orchestratorBuilder = new StateGraph(AgentState)
  .addNode('orchestrator', orchestrator)
  .addNode('worker', worker)
  .addEdge(START, 'orchestrator')
  .addConditionalEdges('orchestrator', routerOrchestrator, ['worker', END])
  .addEdge('worker', 'orchestrator')

// Simple Graph Builder (简单模式 - 只有一个节点)
const simpleBuilder = new StateGraph(AgentState)
  .addNode('simple', simpleNode)
  .addEdge(START, 'simple')
  .addEdge('simple', END)

/**
 * 编译 Orchestrator Graph
 */
export async function getGraph() {
  const checkpointer = await getCheckpointSaver()
  return orchestratorBuilder.compile({ checkpointer })
}

/**
 * 编译 Simple Graph
 */
export async function getSimpleGraph() {
  const checkpointer = await getCheckpointSaver()
  return simpleBuilder.compile({ checkpointer })
}

// 为了向后兼容，也导出一个同步的 graph（不推荐使用）
// export const graph = builder.compile()
