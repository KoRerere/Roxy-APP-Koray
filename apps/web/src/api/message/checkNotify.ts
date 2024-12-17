import type { AxiosResponse } from "axios";
import { API } from "/@/api";
import { emitter } from "/@/utils/eventBus";

let isGettingNotify = false

export async function checkNotify(response: AxiosResponse<any, any>) {
  const userNotify = Number(response.headers['r-user-notify'])

  if (userNotify && !isGettingNotify) {
    isGettingNotify = true
    const result = await API.base.userGetNotifyList().finally(() => {
      isGettingNotify = false
    })
    if (result.code === 0) {
      emitter.emit('notifyUpdateData', result)
    }
  }
}
