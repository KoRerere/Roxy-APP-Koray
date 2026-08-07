import { beforeEach, describe, expect, it } from 'vitest'
import { abortAll, abortRun, cleanupRun, createAbort } from './abortRegistry'

describe('abortRegistry', () => {
  beforeEach(() => {
    abortAll()
  })

  it('does not let an old cleanup delete a replacement controller', () => {
    const oldController = createAbort('run-1')
    const replacementController = createAbort('run-1')

    expect(cleanupRun('run-1', oldController)).toBe(false)
    expect(abortRun('run-1')).toBe(true)
    expect(replacementController.signal.aborted).toBe(true)
  })

  it('keeps an aborted controller registered until its owner finishes cleanup', () => {
    const controller = createAbort('run-1')

    expect(abortRun('run-1')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    expect(cleanupRun('run-1', controller)).toBe(true)
    expect(abortRun('run-1')).toBe(false)
  })
})
