// ---------------------------------------------------------------------------
// SubAgent
// ---------------------------------------------------------------------------

/**
 * A named subagent definition. The main agent dispatches to one of these by
 * `agentType` via the built-in `spawn_agent` tool. Each subagent runs as an isolated child
 * {@link Agent} with its own message history and (optionally) its own model
 * vendor.
 *
 * `tools` omitted means the host decides the child tool set; when present, it
 * is a name allowlist understood by the host-owned child builder. The `task`
 * `spawn_agent` itself is normally withheld from children (delegation depth is a host
 * policy rather than runtime config).
 */
export interface SubAgentSpec {
  /** Dispatch key + model-facing `agent_type` candidate (unique within a config). */
  agentType: string
  /** When-to-use blurb advertised to the parent model in the capability catalog. */
  description: string
  systemPrompt: string
  /** Tool-name allowlist. Omit to inherit the parent's non-delegation tools. */
  tools?: string[]
  /** Override maxTokens for this subagent's model calls. */
  maxTokens?: number
  /** Guidance appended to the parent's catalog on how to write the spawn message. */
  messageGuidance?: string
}
