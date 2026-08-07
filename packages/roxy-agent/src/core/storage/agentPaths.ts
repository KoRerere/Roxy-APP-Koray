import { createAgentPaths, resolveAgentHome } from '@roxy/shared/agent-paths'
import { env } from '@/config'

export const agentPaths = createAgentPaths(resolveAgentHome(env.ENV_TYPE === 'production'))
