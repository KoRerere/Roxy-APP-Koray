import { defineStore } from 'pinia'
import { API } from '/@/api'
import { useVisibilityAwareInterval } from '/@/hooks/useVisibilityAwareInterval'
import { safeParseJSON } from '/@/utils/basic'
import type { UnwrapRowsType, UserGetAnntListListData } from '@roxy/backend-api'
import { useWorkspaceStore } from '/@/stores/workspace'

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

  /** 正式进空间后才拉公告；silent 仅写入 header，不触发公告等副作用 */
  function hasWorkspaceContext() {
    const workspaceStore = useWorkspaceStore()
    return Boolean(workspaceStore.currentWorkspace?.id) && !workspaceStore.workspaceEntrySilent
  }

  /**
   * 拉取公告列表。
   * 后端按请求头 workspaceId 区分普通/电商模式公告，无 workspace 时不得请求。
   */
  async function fetchAnntList() {
    if (!hasWorkspaceContext())
      return []

    const { code, data } = await API.base.userGetAnntListList()
    if (code === 0) {
      setAnntList(data?.rows || [])
    }
    return data?.rows || []
  }

  const FETCH_INTERVAL = 1000 * 60 * 60
  let lastFetchTime = 0

  async function fetchAnntListWithTimestamp() {
    // 无 workspace 时不记时间戳，避免把「跳过」当成已拉取，导致后续就绪后被间隔挡住
    if (!hasWorkspaceContext())
      return []

    lastFetchTime = Date.now()
    return fetchAnntList()
  }

  /** 距上次拉取已超过间隔才请求，避免回前台频繁刷新 */
  function fetchAnntListIfDue() {
    // 首次拉取由 workspace 正式进空间调度；未拉过时不让可见性轮询抢跑
    if (!lastFetchTime)
      return
    if (Date.now() - lastFetchTime >= FETCH_INTERVAL)
      void fetchAnntListWithTimestamp()
  }

  /** 登出 / 重置空间时清空，避免残留上一空间公告 */
  function clearAnntList() {
    setAnntList([])
    lastFetchTime = 0
  }

  /**
   * 由 workspace 在正式进空间、切换空间或切换业务模式时调度。
   * 先清空再拉，避免短暂展示上一模式公告。
   */
  function refreshAnntList() {
    clearAnntList()
    return fetchAnntListWithTimestamp()
  }

  // 定时轮询（页面 hidden 时暂停；回 visible 时由 hook 补跑并校验间隔）
  // 首次拉取不在此处触发，等 workspace 正式进空间后再 refreshAnntList
  useVisibilityAwareInterval(fetchAnntListIfDue, FETCH_INTERVAL)

  return {
    anntList,
    unReadAnnts,
    setAnntList,
    setAnntRead,
    fetchAnntList,
    refreshAnntList,
    clearAnntList,
  }
})
