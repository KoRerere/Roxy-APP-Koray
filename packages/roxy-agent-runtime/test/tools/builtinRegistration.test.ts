import { describe, expect, it } from 'vitest'
import { registerBuiltinTools } from '../../src/tools/builtin/index.ts'
import { ToolRegistry } from '../../src/tools/registry.ts'

describe('registerBuiltinTools', () => {
  it('defaults to the filesystem + shell tools', () => {
    const names = registerBuiltinTools({}).map((t) => t.descriptor.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'read_file',
        'glob',
        'grep',
        'ls',
        'write_file',
        'edit_file',
        'exec_command',
        'write_stdin',
      ]),
    )
    expect(names).not.toContain('execute')
    expect(names).not.toContain('apply_patch')
    expect(names).not.toContain('web_fetch')
  })

  it('uses apply_patch instead of write/edit when the Responses custom tool is enabled', () => {
    const names = registerBuiltinTools({ customToolNames: ['apply_patch'] }).map((t) => t.descriptor.name)
    expect(names).toEqual(
      expect.arrayContaining(['read_file', 'glob', 'grep', 'ls', 'apply_patch', 'exec_command', 'write_stdin']),
    )
    expect(names).not.toContain('execute')
    expect(names).not.toContain('write_file')
    expect(names).not.toContain('edit_file')
  })

  it('marks approval-free continuation tools as read-only and closed-world', () => {
    const byName = new Map(
      registerBuiltinTools({ customToolNames: ['apply_patch'] }).map((t) => [t.descriptor.name, t.descriptor]),
    )
    expect(byName.get('apply_patch')?.kind).toBe('custom')
    expect(byName.get('apply_patch')?.description).toContain('Add File')
    expect(byName.get('apply_patch')?.description).toContain('*** Begin Patch')
    expect(byName.get('apply_patch')?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    })
    expect(byName.get('exec_command')?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    })
    expect(byName.get('write_stdin')?.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
    })
    // read-only family stays unattended in default delegate mode.
    expect(byName.get('read_file')?.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
    expect(byName.get('glob')?.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
    expect(byName.get('grep')?.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
    expect(byName.get('ls')?.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
  })

  it('includes update_plan + ask_user only when their deps are provided', () => {
    const without = registerBuiltinTools({}).map((t) => t.descriptor.name)
    expect(without).not.toContain('todo_read')
    expect(without).not.toContain('update_plan')
    expect(without).not.toContain('ask_user')

    const withDeps = registerBuiltinTools({
      enableTodos: true,
      clarificationHandler: { request: async () => ({ answer: '' }) } as never,
    }).map((t) => t.descriptor.name)
    expect(withDeps).not.toContain('todo_read')
    expect(withDeps).toContain('update_plan')
    expect(withDeps).toContain('ask_user')
  })

  it('every entry is registerable into a ToolRegistry without collision', () => {
    const reg = new ToolRegistry()
    for (const t of registerBuiltinTools({})) {
      reg.add(t.descriptor, t.handler)
    }
    expect(reg.all().map((d) => d.name)).toEqual(
      expect.arrayContaining([
        'read_file',
        'glob',
        'grep',
        'ls',
        'write_file',
        'edit_file',
        'exec_command',
        'write_stdin',
      ]),
    )
    expect(reg.all().map((d) => d.name)).not.toContain('execute')
    expect(reg.all().map((d) => d.name)).not.toContain('apply_patch')
    expect(reg.all().map((d) => d.name)).not.toContain('web_fetch')
  })
})
