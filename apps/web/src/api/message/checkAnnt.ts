import type { AxiosResponse } from "axios";
import { API } from "/@/api";
import { emitter } from "/@/utils/eventBus";

let isGettingAnnt = false

export async function checkAnnt(response: AxiosResponse<any, any>) {
  const userNotify = Number(response.headers['r-user-notify'])
  console.log('userNotify', userNotify)

  if (userNotify && !isGettingAnnt) {
    isGettingAnnt = true
    const { code, data } = await API.base.userGetAnntListList().finally(() => {
      isGettingAnnt = false
    })
    if (code === 0) {
      emitter.emit('anntListUpdateData', data.rows)
    }
  }
}
