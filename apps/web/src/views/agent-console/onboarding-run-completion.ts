import type { AgentRunStatus } from './types'

interface OnboardingRunState {
  status: AgentRunStatus
}

interface OnboardingRunStarted {
  conversationId: string
  runId: string
}

interface OnboardingPromptSendOptions {
  content: string
  onRunStarted: (run: OnboardingRunStarted) => void
}

interface OnboardingPromptDependencies {
  onRunStarted: (run: OnboardingRunStarted) => void
  sendPrompt: (options: OnboardingPromptSendOptions) => Promise<boolean>
  startNewChat: () => Promise<void>
}

export async function sendOnboardingPromptInNewConversation(
  content: string,
  dependencies: OnboardingPromptDependencies,
): Promise<boolean> {
  await dependencies.startNewChat()
  return dependencies.sendPrompt({
    content,
    onRunStarted: dependencies.onRunStarted,
  })
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
