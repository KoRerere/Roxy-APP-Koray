import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getAgentWindowDisplay,
  mergeAgentWindowOpenStatus,
} from './window-display'

describe('getAgentWindowDisplay', () => {
  it('maps the window name, remark, open state, and latest country', () => {
    assert.deepEqual(getAgentWindowDisplay({
      lastCountry: 'hk',
      country: 'US',
      openStatus: true,
      windowName: 'Hong Kong storefront',
      windowRemark: 'Primary account',
    }), {
      iconName: 'country-code/HK',
      isOpen: true,
      name: 'Hong Kong storefront',
      remark: 'Primary account',
    })
  })

  it('falls back to the configured proxy country', () => {
    assert.deepEqual(getAgentWindowDisplay({
      country: 'sg',
    }), {
      iconName: 'country-code/SG',
      isOpen: false,
      name: '',
      remark: '',
    })
  })

  it('uses the detected country for direct or unauthenticated connections', () => {
    assert.equal(getAgentWindowDisplay({ lastCountry: 'JP' }).iconName, 'country-code/JP')
  })

  it('keeps the generic icon fallback when country information is absent', () => {
    assert.equal(getAgentWindowDisplay({}).iconName, '')
  })
})

describe('mergeAgentWindowOpenStatus', () => {
  it('merges the current local opened-window state with the backend state', () => {
    const openedWindowIds = new Set(['locally-open'])

    assert.equal(mergeAgentWindowOpenStatus({ dirId: 'locally-open', openStatus: false }, openedWindowIds).openStatus, true)
    assert.equal(mergeAgentWindowOpenStatus({ dirId: 'backend-open', openStatus: true }, openedWindowIds).openStatus, true)
    assert.equal(mergeAgentWindowOpenStatus({ dirId: 'closed', openStatus: false }, openedWindowIds).openStatus, false)
  })
})
