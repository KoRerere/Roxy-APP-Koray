import { describe, expect, it } from 'vitest'
import { formatBatchRunGroups, formatBatchRunResults, formatRunFailure, formatRunLog, runScriptInputSchema } from './roxy_script_run'

describe('roxy_script_run input schema', () => {
  it('accepts an array of independent script runs', () => {
    expect(runScriptInputSchema.safeParse({
      scriptPath: 'official:test',
      dirIds: ['dir-1', 'dir-2'],
    }).success).toBe(false)

    expect(runScriptInputSchema.safeParse({ scripts: [{
      scriptPath: 'official:test',
      dirIds: ['dir-1', 'dir-2'],
    }, {
      scriptPath: 'official:other',
      dirIds: ['dir-3'],
      params: { keyword: 'different' },
    }] }).success).toBe(true)
  })

  it('accepts layout at the tool-call level and rejects per-script layout', () => {
    // 回归：layout 嵌套在单个脚本项中时，同一次工具调用可为不同脚本组请求冲突的窗口布局。
    // 修复：将 layout 设为整个 scripts 批次共享的单一选项。
    expect(runScriptInputSchema.safeParse({
      layout: 'grid',
      scripts: [{
        scriptPath: 'official:test',
        dirIds: ['dir-1'],
      }, {
        scriptPath: 'official:other',
        dirIds: ['dir-2'],
      }],
    }).success).toBe(true)

    expect(runScriptInputSchema.safeParse({
      scripts: [{
        scriptPath: 'official:test',
        dirIds: ['dir-1'],
        layout: 'grid',
      }],
    }).success).toBe(false)
  })
})

describe('roxy_script_run log formatting', () => {
  it('does not include a log file path when the complete log is already inlined', () => {
    const result = formatRunLog(
      { size: 27, content: 'script completed successfully\n' },
      '/tmp/roxy-script/run.log',
      { inlineLogMaxBytes: 1024 },
      true,
    )

    expect(result).toContain('## Log output')
    expect(result).toContain('Complete log')
    expect(result).toContain('script completed successfully')
    expect(result).not.toContain('## Log file')
    expect(result).not.toContain('/tmp/roxy-script/run.log')
  })

  it('includes the log file path and a paginated-read hint when the log is too large to inline', () => {
    const result = formatRunLog(
      { size: 4096 },
      '/tmp/roxy-script/run.log',
      { inlineLogMaxBytes: 1024 },
      true,
    )

    expect(result).toContain('## Log file')
    expect(result).toContain('/tmp/roxy-script/run.log')
    expect(result).toContain('Read this log file only if more detail is needed')
    expect(result).toContain('offset')
    expect(result).toContain('limit')
  })

  it('includes sandbox error details when a run fails', () => {
    const result = formatRunFailure(
      'official:test',
      { status: 'failed', exitCode: 1, error: 'TypeError: labelRe.test is not a function' },
      '/tmp/roxy-script/run.log',
      { inlineLogMaxBytes: 1024 },
      [],
      { size: 0 },
      { sourceKind: 'local_file', editable: true },
      true,
    )

    expect(result).toContain('failed with exit code 1')
    expect(result).toContain('## Sandbox error')
    expect(result).toContain('TypeError: labelRe.test is not a function')
  })
})

describe('roxy_script_run batch formatting', () => {
  it('keeps window result order and summarizes partial failures', () => {
    const result = formatBatchRunResults('official:test', [
      { dirId: 'dir-1', runId: 'run-1', status: 'success', content: 'first result' },
      { dirId: 'dir-2', runId: 'run-2', status: 'login_required', content: 'second result' },
    ])

    expect(result).toContain('- status: `partial_failure`')
    expect(result).toContain('- total: 2')
    expect(result.indexOf('Window `dir-1`')).toBeLessThan(result.indexOf('Window `dir-2`'))
    expect(result).toContain('first result')
    expect(result).toContain('second result')
  })

  it('formats independent script groups in one result', () => {
    const result = formatBatchRunGroups([
      { scriptName: 'official:first', results: [{ dirId: 'dir-1', runId: 'run-1', status: 'success', content: 'first' }] },
      { scriptName: 'official:second', results: [{ dirId: 'dir-2', runId: 'run-2', status: 'failed', content: 'second' }] },
    ])

    expect(result).toContain('Script `official:first`')
    expect(result).toContain('Script `official:second`')
    expect(result).toContain('- status: `partial_failure`')
  })
})
