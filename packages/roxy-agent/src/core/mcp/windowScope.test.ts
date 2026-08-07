import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  applyForceOpenPolicy,
  checkWindowScope,
  extractDirIds,
  isWindowTargetTool,
} from './windowScope'

describe('extractDirIds', () => {
  it('reads both dirId and dirIds shapes', () => {
    assert.deepEqual(extractDirIds({ dirId: 'a' }), ['a'])
    assert.deepEqual(extractDirIds({ dirIds: ['a', 'b'] }), ['a', 'b'])
    assert.deepEqual(extractDirIds({ dirId: 'a', dirIds: ['b'] }), ['a', 'b'])
    assert.deepEqual(extractDirIds({ dirIds: ['a', '', 1] }), ['a'])
    assert.deepEqual(extractDirIds(undefined), [])
  })
})

describe('isWindowTargetTool', () => {
  it('covers the window-opening tools', () => {
    assert.ok(isWindowTargetTool('roxy_open_browsers'))
    assert.ok(isWindowTargetTool('roxy_browser_launch'))
    assert.ok(isWindowTargetTool('run_script'))
    assert.ok(!isWindowTargetTool('browser_snapshot'))
  })
})

describe('checkWindowScope', () => {
  it('allows dirIds inside the authorized set', () => {
    assert.equal(
      checkWindowScope('roxy_browser_launch', { dirId: 'a' }, new Set(['a', 'b'])),
      undefined,
    )
  })

  it('rejects dirIds outside the authorized set', () => {
    const violation = checkWindowScope('roxy_browser_launch', { dirId: 'c' }, new Set(['a']))
    assert.deepEqual(violation, { toolName: 'roxy_browser_launch', requested: ['c'], allowed: ['a'] })
  })

  it('rejects partial out-of-scope batches', () => {
    const violation = checkWindowScope('roxy_open_browsers', { dirIds: ['a', 'z'] }, new Set(['a']))
    assert.deepEqual(violation?.requested, ['z'])
  })

  it('does not restrict when no window is bound', () => {
    assert.equal(checkWindowScope('roxy_browser_launch', { dirId: 'c' }, undefined), undefined)
    assert.equal(checkWindowScope('roxy_browser_launch', { dirId: 'c' }, new Set()), undefined)
  })

  it('ignores non-window tools', () => {
    assert.equal(checkWindowScope('browser_snapshot', { dirId: 'c' }, new Set(['a'])), undefined)
  })
})

describe('applyForceOpenPolicy', () => {
  it('forces forceOpen false on opening tools', () => {
    assert.deepEqual(
      applyForceOpenPolicy('roxy_browser_launch', { dirId: 'a', forceOpen: true }),
      { dirId: 'a', forceOpen: false },
    )
    assert.deepEqual(
      applyForceOpenPolicy('roxy_open_browsers', { dirIds: ['a'] }),
      { dirIds: ['a'], forceOpen: false },
    )
  })

  it('leaves other tools untouched', () => {
    const input = { dirId: 'a' }
    assert.equal(applyForceOpenPolicy('run_script', input), input)
  })
})
