import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import {
  cacheAgentProfileLabels,
  ensureAgentProfileLabelsForPrompt,
  formatAgentProfileDetails,
  getAgentProfileIdsFromPrompt,
  getCachedAgentProfileLabels,
  normalizeAgentProfileLabel,
} from './profile-token-display'

describe('Agent profile token display', () => {
  it('shows every profile name without a total when there are no more than three', () => {
    assert.equal(
      formatAgentProfileDetails(['DEA-5', '@DEA-4', 'DEA-3']),
      '@DEA-5 · @DEA-4 · @DEA-3',
    )
  })

  it('shows only the first three names followed by the localized Chinese total', () => {
    const originalTranslate = globalThis.$t
    globalThis.$t = (_key, params) => `等 ${params?.count} 个`

    try {
      assert.equal(
        formatAgentProfileDetails(['DEA-5', 'DEA-4', 'DEA-3', 'DEA-2'], 4),
        '@DEA-5 · @DEA-4 · @DEA-3 等 4 个',
      )
    }
    finally {
      globalThis.$t = originalTranslate
    }
  })

  it('fills the first three visible positions after a referenced window is deleted', () => {
    const originalTranslate = globalThis.$t
    globalThis.$t = (_key, params) => `等 ${params?.count} 个`

    try {
      assert.equal(
        formatAgentProfileDetails(['', '2', '3', '4', '5'], 5),
        '@2 · @3 · @4 等 5 个',
      )
    }
    finally {
      globalThis.$t = originalTranslate
    }
  })

  it('keeps the Figma total pattern for English and Russian', () => {
    const originalTranslate = globalThis.$t

    try {
      globalThis.$t = (_key, params) => `· ${params?.count} total`
      assert.equal(
        formatAgentProfileDetails(['DEA-5', 'DEA-4', 'DEA-3', 'DEA-2'], 4),
        '@DEA-5 · @DEA-4 · @DEA-3 · 4 total',
      )

      globalThis.$t = (_key, params) => `· итого ${params?.count}`
      assert.equal(
        formatAgentProfileDetails(['DEA-5', 'DEA-4', 'DEA-3', 'DEA-2'], 4),
        '@DEA-5 · @DEA-4 · @DEA-3 · итого 4',
      )
    }
    finally {
      globalThis.$t = originalTranslate
    }
  })

  it('normalizes labels and extracts unique profile ids from prompt tokens', () => {
    assert.equal(normalizeAgentProfileLabel('@@DEA-5'), '@DEA-5')
    assert.deepEqual(
      getAgentProfileIdsFromPrompt('A [@profile:2](a,b), B [@profile:2](b,c)'),
      ['a', 'b', 'c'],
    )
  })

  it('waits for uncached window labels before making them available to the composer', async () => {
    let finishLoading: (() => void) | undefined
    const requestedIds: string[][] = []
    const loading = ensureAgentProfileLabelsForPrompt(
      'Run [@profile:2](delayed-window-a,delayed-window-b)',
      ids => new Promise((resolve) => {
        requestedIds.push([...ids])
        finishLoading = () => resolve([
          { id: 'delayed-window-a', label: '213-19' },
          { id: 'delayed-window-b', label: '213-18' },
        ])
      }),
    )

    assert.deepEqual(requestedIds, [['delayed-window-a', 'delayed-window-b']])
    assert.deepEqual(getCachedAgentProfileLabels(['delayed-window-a', 'delayed-window-b']), ['', ''])

    finishLoading?.()
    await loading
    assert.deepEqual(
      getCachedAgentProfileLabels(['delayed-window-a', 'delayed-window-b']),
      ['@213-19', '@213-18'],
    )
  })

  it('reloads a window when an earlier fallback cached only its raw id', async () => {
    cacheAgentProfileLabels([{ id: 'fallback-window-id', label: 'fallback-window-id' }])
    const requestedIds: string[][] = []

    await ensureAgentProfileLabelsForPrompt(
      'Run [@profile:1](fallback-window-id)',
      async (ids) => {
        requestedIds.push([...ids])
        return [{ id: 'fallback-window-id', label: '213-17' }]
      },
    )

    assert.deepEqual(requestedIds, [['fallback-window-id']])
    assert.deepEqual(getCachedAgentProfileLabels(['fallback-window-id']), ['@213-17'])
  })

  it('does not treat an unresolved raw window id as a loaded label', async () => {
    await assert.rejects(
      ensureAgentProfileLabelsForPrompt(
        'Run [@profile:1](missing-window-id)',
        async () => [],
      ),
      /missing-window-id/,
    )
  })
})
