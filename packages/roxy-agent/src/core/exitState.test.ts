import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markExited, markStarted } from './exitState'

let root = ''
let filePath = ''

describe('agent exit state', () => {
  beforeEach(async () => {
    root = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-exit-state-'))
    filePath = path.join(root, 'nested', 'exit_state')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fsPromises.rm(root, { recursive: true, force: true })
  })

  it('marks the agent as running when it starts', () => {
    markStarted(filePath)

    expect(fs.readFileSync(filePath, 'utf8')).toBe('1')
  })

  it('warns when the previous agent instance did not exit normally', () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, '1', 'utf8')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    markStarted(filePath)

    expect(warn).toHaveBeenCalledWith('Agent crashed last time')
    expect(fs.readFileSync(filePath, 'utf8')).toBe('1')
  })

  it('marks the agent as cleanly exited after shutdown', () => {
    markStarted(filePath)

    markExited(filePath)

    expect(fs.readFileSync(filePath, 'utf8')).toBe('0')
  })
})
