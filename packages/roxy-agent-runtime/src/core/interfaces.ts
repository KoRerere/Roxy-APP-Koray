/**
 * Public contract compatibility barrel.
 *
 * Contracts are owned by feature-scoped modules under `core/contracts`.
 * Keep this barrel so existing consumers can continue importing from
 * `core/interfaces.ts` while new code may import a narrower module directly.
 */

export * from './contracts/logging.ts'
export * from './contracts/observability.ts'
export * from './contracts/provider.ts'
export * from './contracts/tools.ts'
export * from './contracts/skills.ts'
export * from './contracts/mcp.ts'
export * from './contracts/memory.ts'
export * from './contracts/context.ts'
export * from './contracts/hitl.ts'
export * from './contracts/clarification.ts'
export * from './contracts/todo.ts'
export * from './contracts/subagent.ts'
export * from './contracts/agent.ts'
export * from './contracts/agent-manager.ts'
export * from './contracts/lifecycle.ts'
export * from './contracts/plugins.ts'
