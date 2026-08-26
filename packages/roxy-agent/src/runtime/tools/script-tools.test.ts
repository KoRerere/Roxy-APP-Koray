import type { ToolContext } from 'roxy-agent-runtime'
import { ToolRegistry, zodToJsonSchema } from 'roxy-agent-runtime'
import { describe, expect, it } from 'vitest'
import { createRuntimeFileCollector } from '../file-collector'
import { createScriptToolInvokeConfig, registerRuntimeScriptTools, runtimeScriptRunOptions } from './script-tools'

describe('runtime script tool registration', () => {
  it('registers only the executable script tools', () => {
    // Regression: list_scripts duplicated filesystem discovery already covered
    // by read_file/grep/exec_command and encouraged a stale global script index.
    // Fixed by: keeping only self-description and execution in the tool registry.
    const registry = new ToolRegistry()
    registerRuntimeScriptTools(registry, {
      workspaceDir: '/tmp/roxy-session',
      fileCollector: createRuntimeFileCollector(),
    })

    expect(registry.all().map(tool => tool.name)).toEqual(['roxy_script_describe', 'roxy_script_run'])
    expect(registry.resolve('roxy_script_describe')?.descriptor.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
    })
    expect(registry.resolve('roxy_script_run')?.descriptor.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
    })
    expect(registry.all().every(tool => typeof tool.inputSchema.safeParse === 'function')).toBe(true)
    for (const tool of registry.all()) {
      expect(zodToJsonSchema(tool.inputSchema).type, tool.name).toBe('object')
    }
  })

  it('rejects invalid script input before invoking the adapted tool', async () => {
    const registry = new ToolRegistry()
    registerRuntimeScriptTools(registry, {
      workspaceDir: '/tmp/roxy-session',
      fileCollector: createRuntimeFileCollector(),
    })

    const handler = registry.resolve('roxy_script_describe')?.handler
    expect(handler).toBeDefined()
    const result = await handler!({}, {
      agentId: 'main',
      traceId: 'trace-1',
      toolUseId: 'tool-1',
      signal: new AbortController().signal,
    })
    expect(result).toMatchObject({ isError: true, errorKind: 'input_invalid' })
    expect(result.content).toContain('invalid input for tool "roxy_script_describe"')
  })

  it('advertises local script discovery through the runtime prompt', async () => {
    const { ROXY_MAIN_SYSTEM_PROMPT } = await import('../system-prompt')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('remote_managed')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('local_file')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('editable')
  })

  it('describes the run provenance in script results', async () => {
    const { formatScriptContext } = await import('./roxy_script_run')
    expect(formatScriptContext({
      sourceKind: 'remote_managed',
      editable: false,
      status: 'failed',
    })).toContain('remote_managed')
    expect(formatScriptContext({
      sourceKind: 'local_file',
      editable: true,
      status: 'success',
    })).toContain('local_file')
  })

  it('rejects worker script calls outside the bound browser profile', async () => {
    // Regression: worker script execution was registered outside the MCP
    // window guard and could target a different profile than Playwright.
    // Fixed by: applying the same strict dirId binding to roxy_script_run.
    const registry = new ToolRegistry()
    registerRuntimeScriptTools(registry, {
      workspaceDir: '/tmp/roxy-session',
      fileCollector: createRuntimeFileCollector(),
      allowedDirId: 'dir-1',
    })

    const handler = registry.resolve('roxy_script_run')?.handler
    expect(handler).toBeDefined()
    const result = await handler!({ scriptPath: 'official:test', dirIds: ['dir-2'] }, {
      agentId: 'worker-1',
      traceId: 'trace-1',
      toolUseId: 'tool-1',
      signal: new AbortController().signal,
    })
    expect(result.isError).toBe(true)
    expect(result.content).toContain('dir-2')
  })

  it('rejects worker script calls outside a multi-profile child scope', async () => {
    // Regression: general-purpose agents can receive multiple dirIds, while
    // the local script adapter previously accepted only one allowedDirId.
    // Fixed by: applying one shared allowedDirIds set to roxy_script_run.
    const registry = new ToolRegistry()
    registerRuntimeScriptTools(registry, {
      workspaceDir: '/tmp/roxy-session',
      fileCollector: createRuntimeFileCollector(),
      allowedDirIds: ['dir-1', 'dir-2'],
    })

    const result = await registry.resolve('roxy_script_run')!.handler({
      scriptPath: 'official:test',
      dirIds: ['dir-3'],
    }, {
      agentId: 'worker-1',
      traceId: 'trace-1',
      toolUseId: 'tool-1',
      signal: new AbortController().signal,
    })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('dir-3')
    expect(result.content).toContain('dir-1, dir-2')
  })

  it('forwards ephemeral storage to worker script execution', () => {
    expect(runtimeScriptRunOptions({ ephemeral: true, allowedDirId: 'dir-1' })).toEqual({
      ephemeral: true,
      workspaceDir: undefined,
      fileCollector: undefined,
      taskMonitorTaskId: undefined,
    })
  })

  it('keeps the current tool call id when forwarding runtime metadata', () => {
    // Regression: the global toolContext was spread after the per-call values,
    // replacing toolUseId with an undefined placeholder and splitting live logs
    // from the script event created by tool_started.
    // Fixed by: merging metadata first and stamping per-call values last.
    const writer = () => {}
    const signal = new AbortController().signal
    const context: ToolContext = {
      agentId: 'main',
      traceId: 'trace-1',
      toolUseId: 'tool-1',
      signal,
      metadata: {
        writer,
        toolCall: { id: undefined },
      },
    }

    expect(createScriptToolInvokeConfig(context)).toMatchObject({
      writer,
      signal,
      toolCall: { id: 'tool-1' },
    })
  })
})
