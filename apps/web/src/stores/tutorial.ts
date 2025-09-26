import { defineStore } from 'pinia'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { UserGetGuideVideosByTypeListData } from '@roxy/backend-api'

type VideoMaps = UserGetGuideVideosByTypeListData['data']

export const useTutorialStore = defineStore('tutorial', () => {
  const [_, onlyErrorToast] = useResponseToast()
  const videoMaps = ref<VideoMaps>()

  async function getVideoMaps(force = false) {
    if (videoMaps.value && !force) {
      return videoMaps.value
    }
    const { code, data, msg } = await API.base.userGetGuideVideosByTypeList({})
    onlyErrorToast(code, msg)
    if (code === 0) {
      videoMaps.value = data
    }
    return videoMaps.value
  }

  async function getVideoByType(type: keyof VideoMaps, force = false) {
    if (!videoMaps.value) {
      await getVideoMaps(force)
    }
    return videoMaps.value && Reflect.get(videoMaps.value, type)
  }

  function resetVideoMaps() {
    videoMaps.value = undefined
  }

  return {
    videoMaps,
    getVideoByType,
    getVideoMaps,
    resetVideoMaps,
  }
}, {
  persist: false,
})
