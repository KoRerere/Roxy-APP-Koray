import type { AgentRunStatus } from './types'

interface OnboardingRunState {
  status: AgentRunStatus
}

export function isTrackedOnboardingRunTerminal(
  runId: string | undefined,
  runsById: Record<string, OnboardingRunState>,
): boolean {
  if (!runId) {
    return false
  }

  const status = runsById[runId]?.status
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
