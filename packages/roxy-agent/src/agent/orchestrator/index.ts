import { END, START, StateGraph } from '@langchain/langgraph'
import { before, routerBefore } from './before'
import { orchestrator, routerOrchestrator } from './orchestrator'
import { AgentState } from './state'
import { worker } from './worker'

// Orchestrator Graph Builder (复杂模式)
// 流程：START -> before -> (orchestrator | END) -> (worker | END) -> orchestrator
const orchestratorBuilder = new StateGraph(AgentState)
  .addNode('before', before)
  .addNode('orchestrator', orchestrator)
  .addNode('worker', worker)
  .addEdge(START, 'before')
  .addConditionalEdges('before', routerBefore, ['orchestrator', END])
  .addConditionalEdges('orchestrator', routerOrchestrator, ['worker', END])
  .addEdge('worker', 'orchestrator')

/**
 * 编译 Orchestrator Graph
 */
export const orchestratorGraph = orchestratorBuilder.compile({ })
