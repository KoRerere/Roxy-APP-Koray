import { defineStore } from 'pinia'
import { API } from '/@/api'
import { useVisibilityAwareInterval } from '/@/hooks/useVisibilityAwareInterval'
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

  /** 距上次拉取已超过间隔才请求，避免回前台频繁刷新 */
  function fetchAnntListIfDue() {
    if (Date.now() - lastFetchTime >= FETCH_INTERVAL)
      void fetchAnntListWithTimestamp()
  }

  // 定时轮询（页面 hidden 时暂停；回 visible 时由 hook 补跑并校验间隔）
  useVisibilityAwareInterval(fetchAnntListIfDue, FETCH_INTERVAL)

  return {
    anntList,
    unReadAnnts,
    setAnntList,
    setAnntRead,
  }
})
