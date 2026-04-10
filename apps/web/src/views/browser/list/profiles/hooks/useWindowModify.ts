import { API } from '/@/api'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

export function useWindowModify(options: {
  onlyErrorToast: (code: number, msg: string) => void
  onRefreshTable: (tabParams?: Record<string, unknown>, force?: boolean) => void
}) {
  const { onlyErrorToast } = options

  async function singleModifyWindow(params: any, silent = false) {
    const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
    onlyErrorToast(code, msg)
    if (code === 0) {
      if (!silent)
        options.onRefreshTable()
      return Promise.resolve()
    }
    return Promise.reject(msg)
  }

  async function batchModifyWindow(params: any, silent = false) {
    const { code, msg } = await API.window.userMdfWindowInfoBatchV2Create(params)
    onlyErrorToast(code, msg)
    if (code === 0) {
      if (!silent)
        options.onRefreshTable()
      return Promise.resolve()
    }
    return Promise.reject(msg)
  }

  async function updateProfileMeta(params: Record<string, any>, data: Data, type?: 'single' | 'batch') {
    const { projectId, labelIds, requestType } = params
    const datas = ([] as Data[]).concat(data)
    const ids = datas.map(item => item.id!);

    (type === 'single'
      ? singleModifyWindow({ id: ids[0], projectId, labelIds, requestType }, true)
      : batchModifyWindow({ ids, projectId, labelIds, requestType }, true)
    ).then(() => {
      const updateParams = Object.entries(params).filter(([_, value]) => !!value)
      datas.forEach((item) => {
        updateParams.forEach(([key, value]) => {
          item[key as keyof Data] = value
        })
      })
    })
  }

  return {
    singleModifyWindow,
    batchModifyWindow,
    updateProfileMeta,
  }
}
