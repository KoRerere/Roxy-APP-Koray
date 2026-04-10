import { defineStore } from 'pinia'
import { API } from '/@/api'
import { safeParseJSON } from '/@/utils/basic'
import type { UnwrapRowsType, UserGetAnntListListData } from '@roxy/backend-api'

export const useCommonStore = defineStore('common', () => {
  const anntList = ref<UnwrapRowsType<UserGetAnntListListData>>([])

  const localStatus = ref(safeParseJSON(localStorage.getItem('localStatus')) ?? {})

  const unReadAnnts = computed(() => {
    return anntList.value.filter(annt => !localStatus.value.annt?.includes(annt.id))
  })

  const setAnntList = (rows: UnwrapRowsType<UserGetAnntListListData>) => {
    anntList.value = rows
  }

  function setAnntRead(id: number) {
    const annt = [...new Set([...(localStatus.value.annt || []), id])]
    Reflect.set(localStatus.value, 'annt', annt)
    localStorage.setItem('localStatus', JSON.stringify(localStatus.value))
  }

  async function fetchAnntList() {
    const { code, data } = await API.base.userGetAnntListList()
    if (code === 0) {
      setAnntList(data?.rows || [])
    }
    return data?.rows || []
  }

  const FETCH_INTERVAL = 1000 * 60 * 60
  let lastFetchTime = 0

  async function fetchAnntListWithTimestamp() {
    lastFetchTime = Date.now()
    return fetchAnntList()
  }

  // 定时轮询
  setInterval(fetchAnntListWithTimestamp, FETCH_INTERVAL)

  // 后台恢复时检查是否需要刷新（渲染进程被节流时 setInterval 不可靠）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastFetchTime >= FETCH_INTERVAL) {
      fetchAnntListWithTimestamp()
    }
  })

  return {
    anntList,
    unReadAnnts,
    setAnntList,
    setAnntRead,
  }
})
