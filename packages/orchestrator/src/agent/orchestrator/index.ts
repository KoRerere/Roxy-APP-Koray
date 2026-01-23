import { END, START, StateGraph } from '@langchain/langgraph'
import { orchestrator, routerOrchestrator } from './orchestrator'
import { AgentState } from './state'
import { worker } from './worker'

// Orchestrator Graph Builder (复杂模式)
const orchestratorBuilder = new StateGraph(AgentState)
  .addNode('orchestrator', orchestrator)
  .addNode('worker', worker)
  .addEdge(START, 'orchestrator')
  .addConditionalEdges('orchestrator', routerOrchestrator, ['worker', END])
  .addEdge('worker', 'orchestrator')

/**
 * 编译 Orchestrator Graph
 */
export const orchestratorGraph = orchestratorBuilder.compile({ })
