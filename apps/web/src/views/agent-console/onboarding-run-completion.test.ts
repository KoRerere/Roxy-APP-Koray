import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import type { AgentRunStatus } from './types'
import { isTrackedOnboardingRunTerminal } from './onboarding-run-completion'

describe('Agent onboarding run completion', () => {
  it('waits for the original onboarding run after the user switches conversations', () => {
    const runs: Record<string, { status: AgentRunStatus }> = {
      'onboarding-run': { status: 'streaming' },
      'new-chat-run': { status: 'completed' },
    }

    assert.equal(isTrackedOnboardingRunTerminal('onboarding-run', runs), false)

    runs['onboarding-run'].status = 'completed'
    assert.equal(isTrackedOnboardingRunTerminal('onboarding-run', runs), true)
  })

  for (const status of ['failed', 'cancelled'] as const) {
    it(`treats ${status} as a terminal onboarding result`, () => {
      assert.equal(isTrackedOnboardingRunTerminal('onboarding-run', {
        'onboarding-run': { status },
      }), true)
    })
  }
})
