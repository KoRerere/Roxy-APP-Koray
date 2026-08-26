import { describe, expect, it } from 'vitest'
import { registerBuiltinTools } from '../../src/tools/builtin/index.ts'
import { ToolRegistry } from '../../src/tools/registry.ts'

describe('registerBuiltinTools', () => {
  it('defaults to the filesystem + shell tools', () => {
    // Regression: glob and ls stayed in the default builtin registry after
    // exec_command became the shell-backed path for listing and file discovery.
    // Fixed by: registering only read_file/grep plus shell and mutation tools.
    const names = registerBuiltinTools({}).map((t) => t.descriptor.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'read_file',
        'grep',
        'write_file',
        'edit_file',
        'exec_command',
        'write_stdin',
      ]),
    )
    expect(names).not.toContain('execute')
    expect(names).not.toContain('glob')
    expect(names).not.toContain('ls')
    expect(names).not.toContain('apply_patch')
    expect(names).not.toContain('web_fetch')
  })

  it('uses apply_patch instead of write/edit when the Responses custom tool is enabled', () => {
    const names = registerBuiltinTools({ customToolNames: ['apply_patch'] }).map((t) => t.descriptor.name)
    expect(names).toEqual(
      expect.arrayContaining(['read_file', 'grep', 'apply_patch', 'exec_command', 'write_stdin']),
    )
    expect(names).not.toContain('execute')
    expect(names).not.toContain('glob')
    expect(names).not.toContain('ls')
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
    expect(byName.get('grep')?.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
    expect(byName.get('glob')).toBeUndefined()
    expect(byName.get('ls')).toBeUndefined()
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
        'grep',
        'write_file',
        'edit_file',
        'exec_command',
        'write_stdin',
      ]),
    )
    expect(reg.all().map((d) => d.name)).not.toContain('execute')
    expect(reg.all().map((d) => d.name)).not.toContain('glob')
    expect(reg.all().map((d) => d.name)).not.toContain('ls')
    expect(reg.all().map((d) => d.name)).not.toContain('apply_patch')
    expect(reg.all().map((d) => d.name)).not.toContain('web_fetch')
  })
})
