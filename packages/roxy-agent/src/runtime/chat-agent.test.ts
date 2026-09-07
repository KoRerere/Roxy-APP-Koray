import type { ToolDefinition } from 'roxy-agent-runtime'
import { chatResponse, FakeProvider } from 'roxy-agent-runtime'
import { describe, expect, it } from 'vitest'
import {
  createRuntimeCompactionOptions,
  DEEPSEEK_COMPACTION_RETAINED_USER_TOKENS,
  DEEPSEEK_COMPACTION_TRIGGER_TOKENS,
  DEEPSEEK_CONTEXT_WINDOW_TOKENS,
  DEFAULT_COMPACTION_TRIGGER_RATIO,
  FALLBACK_COMPACTION_TRIGGER_TOKENS,
} from './compaction'
import { filterBuiltinToolsForHostCapabilities } from './host-tools'
import {
  createRuntimeContextMessages,
  createRuntimeMetadataMessage,
  formatOperatingSystem,
} from './prompt-context'
import {
  createGeneralPurposeSystemPrompt,
  createRuntimeSystemPrompt,
  ROXY_MAIN_SYSTEM_PROMPT,
} from './system-prompt'

describe('runtime chat compaction configuration', () => {
  it('passes the business compaction trigger into runtime', () => {
    const provider = {
      contextWindowTokens: DEEPSEEK_CONTEXT_WINDOW_TOKENS,
      chat: async () => {
        throw new Error('unused')
      },
    } as any
    const options = createRuntimeCompactionOptions(provider, 'deepseek-v4-flash')

    expect(DEEPSEEK_CONTEXT_WINDOW_TOKENS).toBe(1_000_000)
    expect(DEFAULT_COMPACTION_TRIGGER_RATIO).toBe(0.5)
    expect(options.trimPolicy).toEqual({
      mode: 'codex',
      keep: DEEPSEEK_COMPACTION_RETAINED_USER_TOKENS,
      retention: 'codex',
      retainedUserTokens: DEEPSEEK_COMPACTION_RETAINED_USER_TOKENS,
    })
    expect(options.triggerTokens).toBe(DEEPSEEK_COMPACTION_TRIGGER_TOKENS)
    expect(options.triggerTokens).toBe(500_000)
    expect(options.contextWindowTokens).toBe(DEEPSEEK_CONTEXT_WINDOW_TOKENS)
    expect(options.trimPolicy.keep).toBeLessThan(options.triggerTokens)
    expect(options.summarizer).toBeDefined()
  })

  it('falls back to an absolute trigger when the provider does not expose a context window', () => {
    const provider = {
      contextWindowTokens: undefined,
      chat: async () => {
        throw new Error('unused')
      },
    } as any
    const options = createRuntimeCompactionOptions(provider, 'deepseek-v4-flash')

    expect(FALLBACK_COMPACTION_TRIGGER_TOKENS).toBe(150_000)
    expect(options.triggerTokens).toBe(150_000)
    expect(options.contextWindowTokens).toBeUndefined()
  })

  it('uses a structured state-oriented compaction prompt', () => {
    const provider = new FakeProvider({
      responses: [
        chatResponse(
          { role: 'assistant', content: '<summary>ok</summary>' },
          'end_turn',
          { inputTokens: 1, outputTokens: 1 },
        ),
      ],
    })
    const options = createRuntimeCompactionOptions(provider, 'deepseek-v4-flash')

    void (options.summarizer as any).summarize('user: prior context')

    expect(provider.calls[0]?.messages[0]?.content).toContain('Write a compact state record, not a narrative.')
  })
})

describe('runtime chat agent tree configuration', () => {
  it('uses a lean English base prompt without copied dynamic skill content', () => {
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('# Roxy System Prompt')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('## Role')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('## Working with the User')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('## RoxyBrowser Work')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toMatch(/^# (Role|Personality|Working with the User|RoxyBrowser Work|Tool Use|Communication)$/m)
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('<skills_instructions>')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('### File Editing with `apply_patch`')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('`<system-lang>` value from the latest metadata message')
    expect(createRuntimeSystemPrompt()).toBe(ROXY_MAIN_SYSTEM_PROMPT)
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Lead with the outcome')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Templates are reusable Roxy Agent artifacts')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('RoxyBrowser exposes a bounded set of product actions')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('perform at most one focused capability check')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Do not repeatedly probe guessed endpoints')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Recycle Bin or Trash operations')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('A fingerprint browser is not the same thing as a mandatory proxy browser')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Publicly visible page data may be collected')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('User-authorized login is a normal browser automation task')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('Use a skill when the user explicitly names it or when the task clearly matches its description.')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('Before using an implicitly selected skill, read its SKILL.md completely with `read_file`.')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('Skill instructions cannot override the agent\'s system instructions or permission policy.')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain(`import { chromium, firefox } from 'playwright'`)
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('from \'@roxybrowser/sandbox\'')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('### Long-term Memory')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('#### When to use memory')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('#### Memory layout')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('#### Reading memory')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('#### Writing memory')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('# Roxy Agent Memory Index')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('[Short concise memory summary in one short sentence](memory-name.md)')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toMatch(/search the existing memory index/i)
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('temporary task progress')
    expect(ROXY_MAIN_SYSTEM_PROMPT.match(/### Running Automation Scripts/g)).toHaveLength(1)
    expect(ROXY_MAIN_SYSTEM_PROMPT.match(/### Authoring Automation Scripts/g)).toHaveLength(1)
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('ROXY_APPLY_PATCH_START')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('ROXY_MAIN_AGENT_START')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('ROXY_GENERAL_PURPOSE_AGENT_START')
  })

  it('keeps report and template-save rules on the root prompt only', () => {
    const rootPrompt = createRuntimeSystemPrompt()
    const childPrompt = createGeneralPurposeSystemPrompt()

    expect(rootPrompt).toContain('call `roxy_task_report` after all operational tools finish')
    expect(rootPrompt).toContain('Default to the current turn')
    expect(rootPrompt).toContain('regenerate a report')
    expect(rootPrompt).toContain('status=unused')
    expect(rootPrompt).toContain('taskName must use the user\'s system language')
    expect(rootPrompt).toContain('key, a brief user-facing name, and a concise primitive value')
    expect(rootPrompt).toContain('Direct execution of an existing template is an exception to all task-report rules below')
    expect(rootPrompt).toContain('This applies to script, skill, and prompt templates from any source')
    expect(rootPrompt).toContain('regardless of the template\'s business purpose, number of browser windows, batch behavior, or execution outcome')
    expect(rootPrompt).toContain('do not produce a report that invites the user to save the same workflow as another template')
    expect(rootPrompt).toContain('`roxy_save_user_template`')
    expect(rootPrompt).toContain('use the `roxy-template-creator` skill')
    expect(rootPrompt).toContain('window-independent companion Composer prompt')
    expect(rootPrompt).toContain('Never copy report window ids or add `[@profile:...]()`')
    expect(childPrompt).not.toContain('roxy_task_report')
    expect(childPrompt).not.toContain('roxy_save_user_template')
  })

  it('prefers rg guidance and rg-based memory search when ripgrep is available', () => {
    const prompt = createRuntimeSystemPrompt({ hasRipgrep: true })
    const generalPrompt = createGeneralPurposeSystemPrompt({ hasRipgrep: true })

    expect(prompt).toContain('- Use `read_file` to inspect known files. For directory listings, text search, or file search, use `exec_command` with `rg` or `rg --files` first')
    expect(prompt).toContain('reach first for `exec_command` with `rg` or `rg --files`')
    expect(prompt).toContain('use `exec_command` with `rg`')
    expect(prompt).not.toContain('`grep` to inspect files before making assumptions')
    expect(prompt).not.toContain('use the available file tools (`grep`, `glob`, `ls`, `read_file`)')
    expect(generalPrompt).toContain('- Use `read_file` to inspect known files. For directory listings, text search, or file search, use `exec_command` with `rg` or `rg --files` first')
    expect(generalPrompt).toContain('- When you search for text or files, reach first for `exec_command` with `rg` or `rg --files`')
  })

  it('keeps grep-oriented guidance when ripgrep is unavailable', () => {
    const prompt = createRuntimeSystemPrompt({ hasRipgrep: false })

    expect(prompt).toContain('Use `read_file` and `grep`')
    expect(prompt).toContain('When you search file contents, use `grep` or `exec_command` as appropriate')
    expect(prompt).toContain('`grep`')
    expect(prompt).not.toContain('`glob`')
    expect(prompt).not.toContain('`ls`')
    expect(prompt).not.toContain('reach first for `exec_command` with `rg` or `rg --files`')
  })

  it('uses the builtin grep fallback tool only when ripgrep is unavailable', () => {
    const builtins: ToolDefinition[] = [
      {
        descriptor: {
          name: 'read_file',
          description: 'read',
          inputSchema: {} as any,
          source: 'builtin',
        },
        handler: async () => ({ content: 'read', isError: false }),
      },
      {
        descriptor: {
          name: 'grep',
          description: 'grep',
          inputSchema: {} as any,
          source: 'builtin',
        },
        handler: async () => ({ content: 'grep', isError: false }),
      },
    ]
    const tools = filterBuiltinToolsForHostCapabilities(builtins, { hasRipgrep: true })
    const fallbackTools = filterBuiltinToolsForHostCapabilities(builtins, { hasRipgrep: false })

    expect(tools.map(tool => tool.descriptor.name)).toEqual(['read_file'])
    expect(fallbackTools.map(tool => tool.descriptor.name)).toEqual(['read_file', 'grep'])
  })

  it('renders basic dynamic information as a hidden metadata user message', () => {
    const metadataMessage = createRuntimeMetadataMessage({
      workingDirectory: '/tmp/work<&',
      recordingPath: '/tmp/recording<&.jsonl',
      memoryDirectory: '/tmp/memory<&',
      memoryIndexFile: '/tmp/memory<&/MEMORY.md',
      metadata: {
        os: 'macOS 26.6',
        arch: 'arm64',
        systemLanguage: 'zh-CN',
        timezone: 'Asia/Shanghai',
      },
    })

    expect(metadataMessage).toEqual({
      role: 'developer',
      content: '<metadata>\n  <os>macOS 26.6</os>\n  <arch>arm64</arch>\n  <system-lang>zh-CN</system-lang>\n  <timezone>Asia/Shanghai</timezone>\n  <cwd>/tmp/work&lt;&amp;</cwd>\n  <browser_ops_record>/tmp/recording&lt;&amp;.jsonl</browser_ops_record>\n  <memory_directory>/tmp/memory&lt;&amp;</memory_directory>\n  <memory_index_file>/tmp/memory&lt;&amp;/MEMORY.md</memory_index_file>\n</metadata>',
      visible: false,
      compactionKey: 'metadata',
      compactionOrder: 0,
    })
  })

  it('formats macOS, Windows, and Linux metadata without platform-specific assumptions', () => {
    expect(formatOperatingSystem({
      platform: 'darwin',
      release: '25.6.0',
      macProductVersion: '26.6',
    })).toBe('macOS 26.6')
    expect(formatOperatingSystem({
      platform: 'darwin',
      release: '25.6.0',
    })).toBe('macOS (Darwin 25.6.0)')
    expect(formatOperatingSystem({
      platform: 'win32',
      release: '10.0.26100',
    })).toBe('Windows 10.0.26100')
    expect(formatOperatingSystem({
      platform: 'linux',
      release: '6.8.0-60-generic',
      linuxPrettyName: 'Ubuntu 24.04.2 LTS',
    })).toBe('Ubuntu 24.04.2 LTS')
    expect(formatOperatingSystem({
      platform: 'linux',
      release: '6.8.0-60-generic',
    })).toBe('Linux 6.8.0-60-generic')
  })

  it('keeps metadata and context files out of the system prompt', () => {
    const systemPrompt = createRuntimeSystemPrompt()
    const contextMessages = createRuntimeContextMessages({
      workingDirectory: '/tmp/work<&',
      recordingPath: '/tmp/recording<&.jsonl',
      memoryDirectory: '/tmp/memory<&',
      memoryIndexFile: '/tmp/memory<&/MEMORY.md',
      metadata: {
        os: 'macOS 26.6',
        arch: 'arm64',
        systemLanguage: 'zh-CN',
        timezone: 'Asia/Shanghai',
      },
    })

    expect(systemPrompt).not.toContain('<os>macOS 26.6</os>')
    expect(systemPrompt).not.toContain('Current date:')
    expect(systemPrompt).not.toContain('/tmp/recording')
    expect(contextMessages).toHaveLength(1)
    expect(contextMessages[0]?.content).toContain('<metadata>')
    expect(contextMessages[0]?.content).not.toContain('<current-date>')
    expect(contextMessages[0]?.content).not.toContain('<current-time>')
    expect(contextMessages[0]?.content).toContain('<cwd>/tmp/work&lt;&amp;</cwd>')
    expect(contextMessages[0]?.content).toContain('<browser_ops_record>/tmp/recording&lt;&amp;.jsonl</browser_ops_record>')
    expect(contextMessages[0]?.content).toContain('<memory_directory>/tmp/memory&lt;&amp;</memory_directory>')
    expect(contextMessages[0]?.content).toContain('<memory_index_file>/tmp/memory&lt;&amp;/MEMORY.md</memory_index_file>')
    expect(contextMessages.every(message => message.role === 'developer' && message.visible === false)).toBe(true)
  })

  it('places a wrapped memory index after metadata and before the real user message', () => {
    // Regression: MEMORY.md was injected as unwrapped Markdown after a separate
    // environment message instead of a self-contained memory user item.
    // Fixed by: metadata owns runtime fields and memory uses a dedicated XML envelope.
    const memoryIndex = '# Roxy Agent Memory Index\n\n- [Remember this](remember-this.md) - Full description'
    const contextMessages = createRuntimeContextMessages({
      workingDirectory: '/tmp/work',
      memoryDirectory: '/tmp/memory',
      memoryIndexFile: '/tmp/memory/MEMORY.md',
      memoryIndex,
      metadata: {
        os: 'macOS 26.6',
        arch: 'arm64',
        systemLanguage: 'zh-CN',
        timezone: 'Asia/Shanghai',
      },
    })
    const input = [...contextMessages, { role: 'user' as const, content: 'real request' }]

    expect(input.map(message => message.content)).toEqual([
      expect.stringContaining('<metadata>'),
      `<memory-md>\n${memoryIndex}\n</memory-md>`,
      'real request',
    ])
    expect(input[1]).toEqual({
      role: 'developer',
      content: `<memory-md>\n${memoryIndex}\n</memory-md>`,
      visible: false,
      compactionKey: 'memory-md',
      compactionOrder: 1,
    })
    expect(input.at(-1)).toEqual({ role: 'user', content: 'real request' })
  })

  it('renders an explicit empty-memory sentinel inside the memory envelope', () => {
    const messages = createRuntimeContextMessages({
      workingDirectory: '/tmp/work',
      memoryDirectory: '/tmp/memory',
      memoryIndexFile: '/tmp/memory/MEMORY.md',
      memoryIndex: '',
      metadata: {
        os: 'macOS 26.6',
        arch: 'arm64',
        systemLanguage: 'zh-CN',
        timezone: 'Asia/Shanghai',
      },
    })

    expect(messages[1]?.content).toBe('<memory-md>\n(Empty memory index)\n</memory-md>')
  })

  it('requires reading relevant linked memory files before using index summaries', () => {
    // Regression: the model treated MEMORY.md summaries as sufficient facts
    // and answered by inference without loading the linked memory entry.
    // Fixed by: the prompt makes linked-file loading a mandatory precondition.
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('The `<memory-md>` content is discovery metadata only')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain(
      'Proactively compare the current request and active task context with the index',
    )
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain(
      'MUST call `read_file` on that entry before planning, answering, or acting',
    )
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain(
      'Resolve a relative link such as `memory-name.md` as `<memory_directory>/memory-name.md`',
    )
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Never infer details from an index line or an entry you have not read')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain(
      'If `read_file` fails, do not fall back to the index summary',
    )
  })

  it('requires updating any related memory entry before creating a new one', () => {
    // Regression: the prompt allowed the model to interpret only exact duplicates
    // as overlapping memory and create a second entry for the same subject.
    // Fixed by: related memory is a mandatory in-place update and new files are a
    // fallback only after search and reads establish that no related entry exists.
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain(
      'you MUST update that entry instead of creating a new one',
    )
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain(
      'Create a new entry only after the search and reads establish that no related entry exists',
    )
  })

  it('injects detailed apply_patch guidance only for the OpenAI api format', () => {
    const openaiPrompt = createRuntimeSystemPrompt({ apiFormat: 'openai' })
    const anthropicPrompt = createRuntimeSystemPrompt({ apiFormat: 'anthropic' })
    const responsesPrompt = createRuntimeSystemPrompt({ apiFormat: 'responses' })

    expect(openaiPrompt).toContain('### File Editing with `apply_patch`')
    expect(openaiPrompt).toContain('Read every existing file before updating, moving, or deleting it')
    expect(openaiPrompt).toContain('Prefer the exact absolute path')
    expect(openaiPrompt).toContain('Pass raw V4A patch text directly')
    expect(openaiPrompt).toContain('Prefer several focused `apply_patch` calls')
    expect(openaiPrompt).toContain('re-read the current file')
    expect(openaiPrompt).toContain('*** Begin Patch')
    expect(openaiPrompt).toContain('*** End Patch')
    expect(openaiPrompt.indexOf('## Rules for getting work done')).toBeLessThan(
      openaiPrompt.indexOf('### File Editing with `apply_patch`'),
    )
    expect(openaiPrompt.indexOf('### File Editing with `apply_patch`')).toBeLessThan(
      openaiPrompt.indexOf('### Autonomy and persistence'),
    )
    expect(anthropicPrompt).not.toContain('### File Editing with `apply_patch`')
    expect(responsesPrompt).not.toContain('### File Editing with `apply_patch`')
  })

  it('builds the general-purpose prompt from the main prompt without delegation instructions', () => {
    const prompt = createGeneralPurposeSystemPrompt({ apiFormat: 'openai' })

    expect(prompt).toContain('## Role')
    expect(prompt).toContain('## Working with the User')
    expect(prompt).toContain('## RoxyBrowser Work')
    expect(prompt).toContain('## Tool Use')
    expect(prompt).toContain('## Communication')
    expect(prompt).toContain('RoxyBrowser exposes a bounded set of product actions')
    expect(prompt).toContain('perform at most one focused capability check')
    expect(prompt).toContain('### Assigned Work')
    expect(prompt).toContain('### File Editing with `apply_patch`')
    expect(prompt).not.toContain('### Subagents')
    expect(prompt).not.toContain('### Long-term Memory')
    expect(prompt).not.toContain('Proactively use `spawn_agent`')
    expect(prompt).not.toContain('call `wait_agent` once')
    expect(prompt).not.toContain('ROXY_GENERAL_PURPOSE_AGENT_START')
  })

  it('asks for clarification instead of refusing unclear or unrelated requests', () => {
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Do not reject a request solely because')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('ask one focused question')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('outside my scope of responsibility')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('Politely decline requests outside')
  })

  it('documents structured dirIds and a plain general-purpose message', () => {
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('general-purpose')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('browser_worker')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('dirIds')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('message')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('spawn_agents')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('strict JSON')
    expect(ROXY_MAIN_SYSTEM_PROMPT).not.toContain('parallel_dispatch')
  })

  it('uses the native batch script tool for the same work across windows', () => {
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('two or more browser profiles/windows')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Only serialize or queue the work when the user explicitly asks')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('run all profile executions in parallel by default')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('call `roxy_script_run` once')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('{ scripts: [{ scriptPath, dirIds, params, debug }, ...] }')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain("all authorized profile ids in that item's `dirIds`")
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('do not create one subagent or tool call per window')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('genuinely independent workstreams')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('Continue with other independent work')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('call `wait_agent` once')
    expect(ROXY_MAIN_SYSTEM_PROMPT).toContain('before giving the final response')
  })
})
