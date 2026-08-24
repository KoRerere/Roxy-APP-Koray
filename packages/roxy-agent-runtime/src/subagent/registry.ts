import type { SubAgentSpec } from '../core/interfaces.ts'

/**
 * Holds the named {@link SubAgentSpec}s supplied by a host. Names must be unique
 * (they are the dispatch key advertised to the model), so a duplicate is a
 * configuration error surfaced at assembly time, not silently last-wins.
 */
export class SubAgentRegistry {
  private readonly specs = new Map<string, SubAgentSpec>()
  private readonly order: string[] = []

  constructor(specs: readonly SubAgentSpec[] = []) {
    for (const spec of specs) {
      if (this.specs.has(spec.agentType)) {
        throw new Error(`SubAgentRegistry: duplicate subagent name '${spec.agentType}' (names must be unique)`)
      }
      this.specs.set(spec.agentType, spec)
      this.order.push(spec.agentType)
    }
  }

  get(name: string): SubAgentSpec | undefined {
    return this.specs.get(name)
  }

  has(name: string): boolean {
    return this.specs.has(name)
  }

  /** Specs in declaration order. */
  list(): SubAgentSpec[] {
    return this.order.map((n) => this.specs.get(n)!)
  }
}
