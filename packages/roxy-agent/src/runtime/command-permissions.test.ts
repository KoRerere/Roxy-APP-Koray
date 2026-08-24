import type { ToolDescriptor } from 'roxy-agent-runtime'
import { CommandPermissions, DelegateHitlHandler } from 'roxy-agent-runtime'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { DEFAULT_COMMAND_ALLOW_PATTERNS, DEFAULT_COMMAND_DENY_PATTERNS } from './command-permissions'

const execCommandDescriptor: ToolDescriptor = {
  name: 'exec_command',
  description: 'Run a shell command.',
  inputSchema: z.object({}),
  source: 'builtin',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
}

describe('product command permissions', () => {
  it('auto-allows the read-only log inspection loop without HITL', () => {
    // Regression: a read-only log inspection loop entered HITL because the
    // command policy did not recognize safe `for ... do ... done` syntax.
    // Fixed by: allowing only loops whose header and body pass the read-only
    // command-chain policy.
    const command = [
      'ls -la /Users/anbin/roxy-agent-dev/workdir/official-facebook-feed-nurture/logs/2026-08-19/',
      'for f in /Users/anbin/roxy-agent-dev/workdir/official-facebook-feed-nurture/logs/2026-08-19/*.log',
      'do echo "==== $f ==="; cat "$f"; done',
    ].join('; ')
    const permissions = new CommandPermissions({
      allow: [...DEFAULT_COMMAND_ALLOW_PATTERNS],
      deny: [...DEFAULT_COMMAND_DENY_PATTERNS],
    })
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions })

    expect(permissions.evaluate('ls -la /Users/anbin/roxy-agent-dev/workdir/official-facebook-feed-nurture/logs/2026-08-19/')).toBe(
      'allow',
    )
    expect(permissions.evaluate('echo "==== $f ==="')).toBe('allow')
    expect(permissions.evaluate('cat "$f"')).toBe('allow')
    expect(permissions.evaluate(command)).toBe('allow')
    expect(hitl.needsApproval(execCommandDescriptor, { cmd: command })).toBe(false)
  })
})
