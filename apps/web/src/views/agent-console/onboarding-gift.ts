import { ContentType } from '@roxy/backend-api'
import { httpClient } from '/@/api'

export interface AgentOnboardingGiftData {
  alreadyGifted: boolean
  grantedPoints: number
  workspaceId: number
  userId: number
  balance: number
  orderNo: string
}

export interface AgentOnboardingGiftResponse {
  code: number
  data: AgentOnboardingGiftData
  msg: string
}

export function grantAgentOnboardingGuidePoints(workspaceId: number) {
  return httpClient.request<AgentOnboardingGiftResponse>({
    path: '/user_grant_onboarding_guide_points',
    method: 'POST',
    headers: {
      workspaceid: String(workspaceId),
    },
    body: {},
    type: ContentType.Json,
    format: 'json',
  })
}
