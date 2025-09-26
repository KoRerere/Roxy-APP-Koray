import type { UserUpdateOnboardingTaskStatusCreatePayload } from "@roxy/backend-api";
import { API } from "/@/api";
// import { useUserStore } from '/@/stores/user'

export function useOnboardingTaskStatus() {
  // const { updateUserConfig } = useUserStore()

  async function updateOnboardingTaskStatus(data: UserUpdateOnboardingTaskStatusCreatePayload) {
    const { code } = await API.base.userUpdateOnboardingTaskStatusCreate(data)
    if (code !== 0) return
    // updateUserConfig()
  }

  return {
    updateOnboardingTaskStatus
  }
}
