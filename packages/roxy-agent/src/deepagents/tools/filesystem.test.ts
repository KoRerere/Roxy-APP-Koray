import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ChatAnthropic } from '@langchain/anthropic'
import { AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { createDeepAgent, FilesystemBackend, GENERAL_PURPOSE_SUBAGENT } from 'deepagents'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { createRoxyFilesystemMiddleware, createRoxyFilesystemTools } from './filesystem'

describe('roxy filesystem tools', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'roxy-filesystem-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('write_file overwrites an existing file without deleting it first', async () => {
    // Regression: deepagents write_file rejected existing files, which made the model run rm before rewriting.
    // Fixed by: the Roxy write_file tool atomically replaces existing file content.
    const filePath = path.join(tempDir, 'script.ts')
    await fs.writeFile(filePath, 'old content', 'utf8')
    const { writeFileTool } = createRoxyFilesystemTools({ rootDir: tempDir })

    const result = await writeFileTool.invoke({
      file_path: filePath,
      content: 'new content',
    })

    assert.match(String(result), /Successfully wrote 11 characters/)
    assert.equal(await fs.readFile(filePath, 'utf8'), 'new content')
  })

  it('edit_file applies several edits sequentially in one write', async () => {
    const filePath = path.join(tempDir, 'script.ts')
    await fs.writeFile(filePath, 'const a = 1\nconst b = 2\n', 'utf8')
    const { editFileTool } = createRoxyFilesystemTools({ rootDir: tempDir })

    const result = await editFileTool.invoke({
      file_path: filePath,
      edits: [
        { old_string: 'const a = 1', new_string: 'const a = 10' },
        { old_string: 'const b = 2', new_string: 'const b = a' },
      ],
    })

    assert.match(String(result), /Applied 2 edits/)
    assert.equal(await fs.readFile(filePath, 'utf8'), 'const a = 10\nconst b = a\n')
  })

  it('edit_file leaves the file untouched when any edit fails', async () => {
    // Regression: several independent edit_file calls could leave a script half-updated after a later failure.
    // Fixed by: all edits are validated in memory before a single atomic file replacement.
    const filePath = path.join(tempDir, 'script.ts')
    const original = 'const a = 1\nconst b = 2\n'
    await fs.writeFile(filePath, original, 'utf8')
    const { editFileTool } = createRoxyFilesystemTools({ rootDir: tempDir })

    await assert.rejects(
      editFileTool.invoke({
        file_path: filePath,
        edits: [
          { old_string: 'const a = 1', new_string: 'const a = 10' },
          { old_string: 'missing', new_string: 'never written' },
        ],
      }),
      /edit #2.*not found/i,
    )
    assert.equal(await fs.readFile(filePath, 'utf8'), original)
  })

  it('routes duplicate deepagents tool names to the Roxy implementations', async () => {
    const middleware = createRoxyFilesystemMiddleware({ rootDir: tempDir }) as any
    const customWrite = middleware.tools.find((candidate: any) => candidate.name === 'write_file')
    const builtinWrite = { name: 'write_file' }
    let modelTools: any[] = []
    let modelSystemMessage: SystemMessage | undefined

    await middleware.wrapModelCall(
      {
        tools: [builtinWrite, { name: 'read_file' }, customWrite],
        systemMessage: new SystemMessage('Built-in filesystem instructions.'),
      },
      async (request: any) => {
        modelTools = request.tools
        modelSystemMessage = request.systemMessage
        return new AIMessage({ content: 'done' })
      },
    )

    assert.equal(modelTools.filter(tool => tool.name === 'write_file').length, 1)
    assert.equal(modelTools.find(tool => tool.name === 'write_file'), customWrite)
    assert.match(modelSystemMessage?.text ?? '', /atomically replaces an existing file/)
    assert.match(modelSystemMessage?.text ?? '', /Never delete an existing file/)

    let routedTool: any
    await middleware.wrapToolCall(
      {
        toolCall: { id: 'call-route', name: 'write_file', args: {} },
        tool: builtinWrite,
      },
      async (request: any) => {
        routedTool = request.tool
        return new ToolMessage({ content: 'ok', tool_call_id: 'call-route' })
      },
    )
    assert.equal(routedTool, customWrite)
  })

  it('can be installed on both the main agent and general-purpose subagent', () => {
    const model = new ChatAnthropic({
      model: 'deepseek-v4-pro',
      apiKey: 'test-key',
      maxTokens: 8192,
    })

    assert.doesNotThrow(() => createDeepAgent({
      model,
      backend: new FilesystemBackend({ rootDir: tempDir }),
      middleware: [createRoxyFilesystemMiddleware({ rootDir: tempDir })],
      subagents: [{
        ...GENERAL_PURPOSE_SUBAGENT,
        middleware: [createRoxyFilesystemMiddleware({ rootDir: tempDir })],
      }],
    }))
  })

  it('does not execute tool calls from a max_tokens response', async () => {
    // Regression: a max_tokens response with parseable write_file JSON wrote a truncated TypeScript file.
    // Fixed by: tool calls from truncated model responses are converted to errors before execution.
    const filePath = path.join(tempDir, 'script.ts')
    await fs.writeFile(filePath, 'complete old script', 'utf8')
    const middleware = createRoxyFilesystemMiddleware({ rootDir: tempDir }) as any
    const baseHandler = vi.fn(async () => new ToolMessage({
      content: 'executed',
      tool_call_id: 'call-truncated',
    }))

    await middleware.wrapModelCall(
      {
        tools: middleware.tools,
        systemMessage: new SystemMessage('Built-in filesystem instructions.'),
      },
      async () => new AIMessage({
        content: '',
        additional_kwargs: { stop_reason: 'max_tokens' },
        tool_calls: [{
          id: 'call-truncated',
          name: 'write_file',
          args: { file_path: filePath, content: 'partial new script' },
          type: 'tool_call',
        }],
      }),
    )

    const result = await middleware.wrapToolCall(
      {
        toolCall: {
          id: 'call-truncated',
          name: 'write_file',
          args: { file_path: filePath, content: 'partial new script' },
        },
      },
      baseHandler,
    )

    assert.equal(baseHandler.mock.calls.length, 0)
    assert.equal((result as ToolMessage).status, 'error')
    assert.match(String((result as ToolMessage).content), /max_tokens/)
    assert.equal(await fs.readFile(filePath, 'utf8'), 'complete old script')
  })
})
