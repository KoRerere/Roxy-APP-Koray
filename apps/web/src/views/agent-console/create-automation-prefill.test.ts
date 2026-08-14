import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import {
  buildCreateAutomationAgentRoute,
  buildCreateAutomationPrompt,
  buildCreateAutomationPromptAfterWindowLoad,
  isCreateAutomationRequest,
  parseCreateAutomationWindowIds,
} from './create-automation-prefill'
import {
  clearPendingCreateAutomationGuide,
  getCreateAutomationGuideStorageKey,
  hasPendingCreateAutomationGuide,
  hasShownCreateAutomationGuide,
  markCreateAutomationGuideShown,
  requestCreateAutomationGuide,
} from './create-automation-guide'

describe('create automation Agent prefill', () => {
  it('builds an Agent home route with unique selected window ids', () => {
    assert.equal(
      buildCreateAutomationAgentRoute(['window-a', 'window-b', 'window-a']),
      '/agent-console?prefill=create-automation&windowIds=window-a%2Cwindow-b',
    )
  })

  it('builds the localized run instruction around the Agent profile token', () => {
    assert.equal(
      buildCreateAutomationPrompt(
        ['window-a', 'window-b', 'window-a'],
        profileReference => `在 ${profileReference} 窗口中运行`,
      ),
      '在 [@profile:2](window-a,window-b) 窗口中运行',
    )
  })

  it('waits for the selected windows before exposing the composer prompt', async () => {
    let finishLoading: (() => void) | undefined
    const loadedIds: string[][] = []
    const promptPromise = buildCreateAutomationPromptAfterWindowLoad(
      ['window-a', 'window-b', 'window-a'],
      ids => new Promise<void>((resolve) => {
        loadedIds.push([...ids])
        finishLoading = resolve
      }),
      profileReference => `Run in ${profileReference}`,
    )
    let settled = false
    void promptPromise.then(() => {
      settled = true
    })

    await Promise.resolve()
    assert.deepEqual(loadedIds, [['window-a', 'window-b']])
    assert.equal(settled, false)

    finishLoading?.()
    assert.equal(await promptPromise, 'Run in [@profile:2](window-a,window-b)')
  })

  it('recognizes scalar and array create requests', () => {
    assert.equal(isCreateAutomationRequest('create-automation'), true)
    assert.equal(isCreateAutomationRequest(['create-automation']), true)
    assert.equal(isCreateAutomationRequest('batch-create-profiles'), false)
  })

  it('parses and deduplicates selected window ids', () => {
    assert.deepEqual(
      parseCreateAutomationWindowIds(['window-a, window-b,window-a']),
      ['window-a', 'window-b'],
    )
  })

  it('stores the automation guide state separately for each account', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    assert.equal(getCreateAutomationGuideStorageKey('user@example.com'), 'agent-console:create-automation-guide-shown:user%40example.com')
    assert.equal(hasShownCreateAutomationGuide('account-a', storage), false)
    markCreateAutomationGuideShown('account-a', storage)
    assert.equal(hasShownCreateAutomationGuide('account-a', storage), true)
    assert.equal(hasShownCreateAutomationGuide('account-b', storage), false)
  })

  it('keeps the automation guide request pending until the composer consumes it', () => {
    clearPendingCreateAutomationGuide()
    requestCreateAutomationGuide()
    assert.equal(hasPendingCreateAutomationGuide(), true)
    clearPendingCreateAutomationGuide()
    assert.equal(hasPendingCreateAutomationGuide(), false)
  })
})
