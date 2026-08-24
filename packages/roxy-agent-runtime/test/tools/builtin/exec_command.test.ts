import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import type { ToolContext } from '../../../src/core/interfaces.ts'
import { CommandPermissions } from '../../../src/tools/builtin/command_permissions.ts'
import { execCommandTool } from '../../../src/tools/builtin/exec_command.ts'
import { ExecCommandProcessManager } from '../../../src/tools/builtin/exec_command_process_manager.ts'
import { writeStdinTool } from '../../../src/tools/builtin/write_stdin.ts'
import { makeTempDir } from '../../helpers/tempDir.ts'

const ctx: ToolContext = {
  agentId: 'test-agent',
  traceId: 'test-trace',
  signal: new AbortController().signal,
}

describe('exec_command', () => {
  let tmpPath: string
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    ;({ path: tmpPath, cleanup } = await makeTempDir())
  })

  afterEach(async () => {
    await cleanup()
  })

  it('returns Codex-style output and exit code 0', async () => {
    // Regression: the shell tool exposed the old execute/command schema and
    // returned bespoke stdout/stderr fields instead of the exec_command format.
    // Fixed by: register exec_command with cmd/workdir and render Codex-style chunks.
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'echo hello', workdir: tmpPath }, ctx)

    expect(result.isError).toBe(false)
    expect(result.content).toContain('Chunk ID:')
    expect(result.content).toContain('Process exited with code 0')
    expect(result.content).toContain('Output:\nhello')
  })

  it('does not mark non-zero process exit as a tool error', async () => {
    // Regression: execute returned isError=true for any non-zero command exit,
    // causing ordinary process status to look like a tool infrastructure failure.
    // Fixed by: keep isError=false when the process launched and exited normally.
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'exit 7' }, ctx)

    expect(result.isError).toBe(false)
    expect(result.content).toContain('Process exited with code 7')
  })

  it.skipIf(process.platform === 'win32')('runs Bash process substitution on Unix-like hosts', async () => {
    // Regression: Unix-like command execution can silently fall back to /bin/sh,
    // breaking Bash syntax that models commonly produce.
    // Fixed by: resolve the default Unix-like shell to /bin/bash explicitly.
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'diff <(printf a) <(printf a)' }, ctx)

    expect(result.isError).toBe(false)
    expect(result.content).toContain('Process exited with code 0')
  })

  it.skipIf(process.platform === 'win32')('kills a pipeline quickly when the manager lifetime expires', async () => {
    // Regression: killing only the top-level shell left pipeline children alive,
    // so timeout-style failures waited for inherited stdio to close much later.
    // Fixed by: run Unix-like commands in a process group and kill the group.
    const processManager = new ExecCommandProcessManager({ lifetimeMs: 100, nextSessionId: () => 9001 })
    const { handler } = execCommandTool({ processManager })
    const startedAt = Date.now()
    const result = await handler({ cmd: 'sleep 60 | cat', yield_time_ms: 5_000 }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('exec_command: timeout')
    expect(Date.now() - startedAt).toBeLessThan(2_000)
  })

  it('hard-blocks denied commands before spawning', async () => {
    // Regression: the command permission hard-deny has to migrate from the old
    // command field to exec_command.cmd without weakening the policy boundary.
    // Fixed by: evaluate CommandPermissions against cmd before process spawn.
    const permissions = new CommandPermissions({ deny: ['touch *'] })
    const { handler } = execCommandTool({ commandPermissions: permissions })
    const result = await handler({ cmd: `touch ${join(tmpPath, 'evil.txt')}`, workdir: tmpPath }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('denied')
    expect(await readdir(tmpPath)).toEqual([])
  })

  it('returns a tool error when the requested shell cannot start', async () => {
    // Regression: a missing shell binary was reported as an ordinary process
    // exit, hiding an infrastructure failure from the agent loop.
    // Fixed by: preserve child startup errors as a distinct tool-level error.
    const { handler } = execCommandTool()
    const result = await handler({ cmd: 'echo hello', shell: '/missing/bash' }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('failed to start')
  })

  it('truncates oversized output with a Codex-style warning and omission marker', async () => {
    // Regression: output truncation discarded context without a stable warning
    // format that models could recognize.
    // Fixed by: use max_output_tokens and render an omission marker in Output.
    const { handler } = execCommandTool()
    const result = await handler(
      {
        cmd: 'node -e "process.stdout.write(\'a\'.repeat(2000))"',
        max_output_tokens: 100,
      },
      ctx,
    )

    expect(result.isError).toBe(false)
    expect(result.content).toContain('Warning: truncated output')
    expect(result.content).toContain('...[omitted ')
  })

  it('returns a session id for a still-running command and write_stdin can poll it', async () => {
    // Regression: execute was single-shot and could not return early while a
    // process continued in the background for later polling.
    // Fixed by: keep background processes in a manager and expose write_stdin.
    const processManager = new ExecCommandProcessManager({ nextSessionId: () => 4242 })
    const exec = execCommandTool({ processManager })
    const write = writeStdinTool({ processManager })

    const started = await exec.handler(
      {
        cmd: 'node -e "setTimeout(() => console.log(\'later\'), 100); setTimeout(() => {}, 1000)"',
        yield_time_ms: 250,
      },
      ctx,
    )
    expect(started.isError).toBe(false)
    expect(started.content).toContain('Process running with session ID 4242')

    const polled = await write.handler({ session_id: 4242, yield_time_ms: 2_000 }, ctx)
    expect(polled.isError).toBe(false)
    expect(polled.content).toContain('Process exited with code 0')
    expect(polled.content).toContain('later')

    const again = await write.handler({ session_id: 4242 }, ctx)
    expect(again.isError).toBe(true)
    expect(again.content).toContain('unknown session')
  })

  it('aborts a running command through ToolContext.signal', async () => {
    // Regression: command execution ignored ToolContext.signal and could leave
    // child processes running after the parent turn was cancelled.
    // Fixed by: attach abort cleanup to exec_command and terminate the process tree.
    const controller = new AbortController()
    const { handler } = execCommandTool()
    const startedAt = Date.now()
    const pending = handler({ cmd: 'sleep 60', yield_time_ms: 5_000 }, { ...ctx, signal: controller.signal })

    setTimeout(() => controller.abort(), 100)
    const result = await pending

    expect(result.isError).toBe(true)
    expect(result.content).toContain('exec_command: aborted')
    expect(Date.now() - startedAt).toBeLessThan(2_000)
  })

  it('rejects stdin writes for non-PTY background sessions', async () => {
    // Regression: write_stdin must not pretend pipe-based commands are fully
    // interactive before a PTY implementation exists.
    // Fixed by: allow empty polling but return a clear error for non-empty chars.
    const processManager = new ExecCommandProcessManager({ nextSessionId: () => 3131 })
    const exec = execCommandTool({ processManager })
    const write = writeStdinTool({ processManager })

    await exec.handler({ cmd: 'sleep 2', yield_time_ms: 250 }, ctx)
    const result = await write.handler({ session_id: 3131, chars: 'hello\n' }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('stdin writes require tty support')
  })
})
