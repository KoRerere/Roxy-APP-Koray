import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readdir, writeFile } from 'node:fs/promises'
import type { ToolContext } from '../../../src/core/interfaces.ts'
import { CommandPermissions } from '../../../src/tools/builtin/command_permissions.ts'
import { execCommandTool } from '../../../src/tools/builtin/exec_command.ts'
import { DelegateHitlHandler, StrictHitlHandler } from '../../../src/hitl/handler.ts'
import { makeTempDir } from '../../helpers/tempDir.ts'
import { testToolInputSchema } from '../../helpers/toolSchema.ts'

const ctx: ToolContext = {
  agentId: 'test-agent',
  traceId: 'test-trace',
  signal: new AbortController().signal,
}

describe('CommandPermissions.evaluate', () => {
  it("returns 'allow' for a command matching an allow pattern", () => {
    const p = new CommandPermissions({ allow: ['git status*', 'npm test*'] })
    expect(p.evaluate('git status')).toBe('allow')
    expect(p.evaluate('git status --short')).toBe('allow')
    expect(p.evaluate('npm test')).toBe('allow')
  })

  it("returns 'ask' for a command matching nothing", () => {
    const p = new CommandPermissions({ allow: ['git status*'] })
    expect(p.evaluate('git push')).toBe('ask')
    expect(p.evaluate('ls')).toBe('ask')
  })

  it("returns 'deny' for a command matching a deny pattern", () => {
    const p = new CommandPermissions({ deny: ['rm *', 'sudo *'] })
    expect(p.evaluate('rm -rf /tmp/x')).toBe('deny')
    expect(p.evaluate('sudo reboot')).toBe('deny')
  })

  it('deny wins over allow', () => {
    const p = new CommandPermissions({ allow: ['git *'], deny: ['git push*'] })
    expect(p.evaluate('git push origin main')).toBe('deny')
    expect(p.evaluate('git status')).toBe('allow')
  })

  it('unsafe compound commands never auto-allow', () => {
    const p = new CommandPermissions({ allow: ['git status*', 'echo *'] })
    // An allow prefix must not smuggle a second command past the gate.
    expect(p.evaluate('git status && rm -rf /')).toBe('ask')
    expect(p.evaluate('git status; rm -rf /')).toBe('ask')
    expect(p.evaluate('git status | sh')).toBe('ask')
    expect(p.evaluate('echo $(rm -rf /)')).toBe('ask')
    expect(p.evaluate('echo `whoami`')).toBe('ask')
    expect(p.evaluate('echo hi > /etc/passwd')).toBe('ask')
    expect(p.evaluate('echo hi\nrm -rf /')).toBe('ask')
  })

  it('deny still applies to compound commands', () => {
    const p = new CommandPermissions({ deny: ['*rm -rf*'] })
    expect(p.evaluate('git status && rm -rf /')).toBe('deny')
  })

  it('trims surrounding whitespace before matching', () => {
    const p = new CommandPermissions({ allow: ['git status*'] })
    expect(p.evaluate('  git status  ')).toBe('allow')
  })

  it('treats PowerShell expressions and script blocks as control syntax', () => {
    const p = new CommandPermissions({ allow: ['Write-Output *', 'Get-ChildItem *'] })
    expect(p.evaluate('Write-Output (Remove-Item file.txt)', 'pwsh')).toBe('ask')
    expect(p.evaluate('Write-Output @(Remove-Item file.txt)', 'powershell.exe')).toBe('ask')
    expect(
      p.evaluate(
        'Write-Output @{ value = (Remove-Item file.txt) }',
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      ),
    ).toBe('ask')
    expect(p.evaluate('Get-ChildItem | Remove-Item', 'pwsh')).toBe('ask')
  })

  it('allows safe read-only query chains used for repository inspection', () => {
    // Regression: ordinary rg/find inspection pipelines and sequential find
    // probes were treated as compound commands and unnecessarily entered HITL.
    // Fixed by: allowing a chain only when every command segment is already
    // allow-listed and the shell syntax has no executable substitution or
    // file-writing redirection.
    const p = new CommandPermissions({
      allow: ['rg', 'rg *', 'find', 'find *', 'head', 'head *'],
      deny: ['find *-delete*', 'find *-exec*', 'find *-execdir*'],
    })

    expect(p.evaluate('rg --files /Users/anbin/Projects/roxy-agent-server | rg -i "sandbox|utils" | head -50')).toBe(
      'allow',
    )
    expect(p.evaluate('find /Users/anbin -maxdepth 6 -type d -name "sandbox" 2>/dev/null | head -20')).toBe('allow')
    expect(
      p.evaluate(
        'find /Users/anbin -maxdepth 6 -type d -name "sandbox" 2>/dev/null; find /Users/anbin -maxdepth 8 -path "*@roxybrowser/sandbox*" -name "*.js" 2>/dev/null | head -20',
      ),
    ).toBe('allow')
  })

  it('allows safe file inspection loops without allowing mutations or redirects', () => {
    const p = new CommandPermissions({
      allow: ['cat', 'cat *', 'echo', 'echo *'],
      deny: ['rm *'],
    })

    expect(p.evaluate('for f in /tmp/*.log; do echo "$f"; cat "$f"; done')).toBe('allow')
    expect(p.evaluate('for f in /tmp/*.log; do rm "$f"; done')).toBe('deny')
    expect(p.evaluate('for f in /tmp/*.log; do cat "$f" > output.txt; done')).toBe('ask')
  })

  it('allows curl probes without allowing local file writes or uploads', () => {
    // Regression: curl-based HTTP probes were gated even when they only wrote
    // to stdout, interrupting common diagnostics and API inspection.
    // Fixed by: allowing curl itself while keeping output-file and upload
    // options in the command deny list.
    const p = new CommandPermissions({
      allow: ['curl', 'curl *', 'head', 'head *'],
      deny: ['curl *-o*', 'curl *-O*', 'curl *--output*', 'curl *--remote-name*', 'curl *-T*', 'curl *--upload-file*'],
    })

    expect(p.evaluate('curl https://example.com')).toBe('allow')
    expect(p.evaluate('curl -I https://example.com | head -20')).toBe('allow')
    expect(p.evaluate('curl -sS https://example.com 2>/dev/null | head -20')).toBe('allow')
    expect(p.evaluate('curl -o response.txt https://example.com')).toBe('deny')
    expect(p.evaluate('curl --output response.txt https://example.com')).toBe('deny')
    expect(p.evaluate('curl -O https://example.com/archive.zip')).toBe('deny')
    expect(p.evaluate('curl -T secret.txt https://example.com/upload')).toBe('deny')
  })

  it('does not allow unsafe commands hidden inside an otherwise safe chain', () => {
    const p = new CommandPermissions({
      allow: ['rg', 'rg *', 'find', 'find *', 'head', 'head *'],
      deny: ['find *-delete*', 'find *-exec*', 'find *-execdir*', 'rm *'],
    })

    expect(p.evaluate('rg TODO src | rm -f result.txt')).toBe('deny')
    expect(p.evaluate('find src -type f -delete')).toBe('deny')
    expect(p.evaluate('find src -type f -exec rm {} \\;')).toBe('deny')
    expect(p.evaluate('rg TODO src > result.txt')).toBe('ask')
    expect(p.evaluate('rg $(rm -rf /) src')).toBe('ask')
  })
})

describe('exec_command tool with command permissions', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
  })
  afterEach(() => cleanup())

  it('hard-blocks a denied command without running it', async () => {
    const permissions = new CommandPermissions({ deny: ['touch *'] })
    const { handler } = execCommandTool({ commandPermissions: permissions })

    const result = await handler({ cmd: `touch ${join(tmpPath, 'evil.txt')}`, workdir: tmpPath }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('denied')
    // The command must NOT have executed.
    expect(await readdir(tmpPath)).toEqual([])
  })

  it('runs allowed and unmatched commands normally', async () => {
    const permissions = new CommandPermissions({ allow: ['echo *'], deny: ['rm *'] })
    const { handler } = execCommandTool({ commandPermissions: permissions })

    const allowed = await handler({ cmd: 'echo hello' }, ctx)
    expect(allowed.isError).toBe(false)
    expect(allowed.content).toContain('hello')

    // Unmatched ("ask") commands are not blocked at the tool layer — the
    // HITL gate upstream owns the approval; the tool only enforces deny.
    const unmatched = await handler({ cmd: 'pwd' }, ctx)
    expect(unmatched.isError).toBe(false)
  })

  it('without permissions the tool behaves as before', async () => {
    const file = join(tmpPath, 'ok.txt')
    await writeFile(file, 'x')
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'ls', workdir: tmpPath }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('ok.txt')
  })
})

describe('HITL handlers with command permissions', () => {
  const executeDescriptor = {
    name: 'exec_command',
    description: 'run',
    inputSchema: testToolInputSchema,
    source: 'builtin' as const,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  }

  it('delegate mode: allow-listed command skips approval', () => {
    const permissions = new CommandPermissions({ allow: ['git status*'] })
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions })

    expect(hitl.needsApproval(executeDescriptor, { cmd: 'git status' })).toBe(false)
    // Unmatched commands still hit the annotations-based approval gate.
    expect(hitl.needsApproval(executeDescriptor, { cmd: 'git push' })).toBe(true)
  })

  it('delegate mode: denied command skips approval (tool hard-blocks it)', () => {
    const permissions = new CommandPermissions({ deny: ['rm *'] })
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions })
    // No point asking a human about a command that policy already refuses.
    expect(hitl.needsApproval(executeDescriptor, { cmd: 'rm -rf /' })).toBe(false)
  })

  it('strict mode: an explicit allow pattern bypasses even strict approval', () => {
    const permissions = new CommandPermissions({ allow: ['git status*'] })
    const hitl = new StrictHitlHandler(false, { commandPermissions: permissions })

    expect(hitl.needsApproval(executeDescriptor, { cmd: 'git status' })).toBe(false)
    expect(hitl.needsApproval(executeDescriptor, { cmd: 'git push' })).toBe(true)
  })

  it('compound command riding an allow pattern still needs approval', () => {
    const permissions = new CommandPermissions({ allow: ['git status*'] })
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions })
    expect(hitl.needsApproval(executeDescriptor, { cmd: 'git status && rm -rf /' })).toBe(true)
  })

  it('non-exec_command tools are unaffected by command permissions', () => {
    const permissions = new CommandPermissions({ allow: ['*'] })
    const hitl = new DelegateHitlHandler([], { commandPermissions: permissions })
    const patchDescriptor = { ...executeDescriptor, name: 'apply_patch' }
    expect(hitl.needsApproval(patchDescriptor, { cmd: 'anything' })).toBe(true)
  })
})
