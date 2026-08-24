import { describe, expect, it } from 'vitest'
import { buildTestAgent, endTurnResponse, toolCallResponse } from '../helpers/buildTestAgent.ts'
import { AgentManager } from '../../src/subagent/agent-manager.ts'
import { spawnAgentTool } from '../../src/tools/builtin/spawn-agent.ts'
import { listAgentsTool } from '../../src/tools/builtin/list-agents.ts'
import { waitAgentTool } from '../../src/tools/builtin/wait-agent.ts'
import type {
  AgentResponse,
  ChatRequest,
  ManagedAgentBuilder,
  Message,
  SubAgentSpec,
} from '../../src/core/interfaces.ts'

const serialize = (messages: Message[]): string => JSON.stringify(messages)

const specs: SubAgentSpec[] = [{ agentType: 'coder', description: 'writes code', systemPrompt: 'You are coder.' }]

function newManagerWithChild(childInvoke: (message: string) => Promise<AgentResponse>): {
  manager: AgentManager
  invokeCalls: string[]
} {
  const invokeCalls: string[] = []
  const builder: ManagedAgentBuilder = async () => ({
    invoke: async (message) => {
      invokeCalls.push(message)
      return childInvoke(message)
    },
    dispose: async () => {},
  })
  const manager = new AgentManager({ specs: new Map(specs.map((s) => [s.agentType, s])), builder })
  manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })
  return { manager, invokeCalls }
}

describe('subagent e2e - main loop spawns a background child and waits', () => {
  it('main spawns a child via spawn_agent and collects its report via wait_agent', async () => {
    const child = buildTestAgent({
      handler: (req: ChatRequest) => {
        const last = req.messages.at(-1)
        const task = typeof last?.content === 'string' ? last.content : ''
        return endTurnResponse(`child processed: ${task}`)
      },
    })
    const { manager } = newManagerWithChild(async (message) => child.agent.invoke(message))

    const spawn = spawnAgentTool({ specs })
    const wait = waitAgentTool()
    const list = listAgentsTool()

    let calls = 0
    const main = buildTestAgent({
      agentManager: manager,
      agentPath: '/root',
      tools: [
        { descriptor: spawn.descriptor, handler: spawn.handler },
        { descriptor: wait.descriptor, handler: wait.handler },
        { descriptor: list.descriptor, handler: list.handler },
      ],
      handler: () => {
        calls++
        if (calls === 1) {
          return toolCallResponse(`tu-${calls}`, 'spawn_agent', {
            agent_type: 'coder',
            name: 'worker',
            message: 'write parser',
          })
        }
        if (calls === 2) {
          return toolCallResponse(`tu-${calls}`, 'wait_agent', {})
        }
        return endTurnResponse('main done')
      },
    })

    const resp = await main.agent.invoke('please build a parser')

    // The child ran exactly once; its report crossed back via wait_agent.
    expect(child.provider.calls.length).toBe(1)
    expect(serialize(resp.messages)).toContain('child processed: write parser')
  })

  it('list_agents shows the spawned child path', async () => {
    const child = buildTestAgent({
      handler: () => endTurnResponse('child report'),
    })
    const { manager } = newManagerWithChild(async (message) => child.agent.invoke(message))

    const spawn = spawnAgentTool({ specs })
    const list = listAgentsTool()

    let calls = 0
    const main = buildTestAgent({
      agentManager: manager,
      agentPath: '/root',
      tools: [
        { descriptor: spawn.descriptor, handler: spawn.handler },
        { descriptor: list.descriptor, handler: list.handler },
      ],
      handler: () => {
        calls++
        if (calls === 1) {
          return toolCallResponse(`tu-${calls}`, 'spawn_agent', {
            agent_type: 'coder',
            name: 'worker',
            message: 'm',
          })
        }
        if (calls === 2) {
          return toolCallResponse(`tu-${calls}`, 'list_agents', {})
        }
        return endTurnResponse('done')
      },
    })

    const resp = await main.agent.invoke('go')
    expect(serialize(resp.messages)).toContain('/root/worker')
  })
})
