import type { Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { ProfileReqType } from '/@/enums'
import { buildCustomFilterParamsFromMenu } from '/@/views/browser/list/profiles/utils/filterParams'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

export type ProfileOpData = UserGetWindowInfoListListData['data']['rows'][number]

export interface ProfileOperationDeps {
  saveLocalTrack: (name: string) => void
  tableRef: Ref<{ getParams: () => { page_index?: string }, refresh: (p?: Record<string, unknown>, f?: boolean) => void } | null>
  filtersMenu: Ref<any>
  router: Router
  route: RouteLocationNormalizedLoaded
  getCurrentFilter: () => Record<string, any> | undefined
  copyTextFn: (text: string) => void
  showToast: (code: number, msg: string) => void
  onTransfer: (datas: ProfileOpData[], operate?: any) => Promise<void>
  onMoveToProject: (data: any) => void | Promise<void>
  openBrowserBefore: (data: ProfileOpData | ProfileOpData[]) => Promise<void>
  setAsDefaultBrowser: (data: ProfileOpData) => Promise<void>
  createDesktopShortcut: (data: ProfileOpData) => Promise<void>
  multipleProxyChange: (data: ProfileOpData | ProfileOpData[], opts: { operationType: string, proxyMethod: string }) => Promise<void>
  multipleProxyDelete: (data: ProfileOpData | ProfileOpData[]) => void
  multipleAccountChange: (data: ProfileOpData | ProfileOpData[], opts: { operationType: string, isChoose: boolean }) => Promise<void>
  tagsIconRef: Ref<any>
  addTag: (opts: any) => void
  updateProfileMeta: (params: Record<string, any>, data: ProfileOpData, type?: 'single' | 'batch') => Promise<void>
  singleModifyWindow: (params: any, silent?: boolean) => Promise<any>
  onRemark: (data: ProfileOpData | ProfileOpData[]) => void | Promise<void>
  onEditCookies: (data: ProfileOpData | ProfileOpData[]) => Promise<void>
  openCookieRobot: (data: ProfileOpData | ProfileOpData[]) => Promise<void>
  onClearCache: (datas: ProfileOpData[]) => Promise<void>
  exportProfile: (data: any) => void | Promise<void>
  deleteProfile: (datas: any, ids: number[]) => void | Promise<void>
  onTestProxy: (datas: ProfileOpData) => void | Promise<void>
}

type OpCtx = ProfileOperationDeps & {
  operate: any
  datas: ProfileOpData[]
  ids: number[]
  data: ProfileOpData
  operationType: 'single' | 'batch'
}

async function handleEdit(ctx: OpCtx) {
  const { page_index } = ctx.tableRef.value!.getParams()
  const customFilterParams = buildCustomFilterParamsFromMenu(ctx.filtersMenu.value)
  ctx.router.push({
    name: 'browser-edit',
    query: {
      ...ctx.route.query,
      id: ctx.data.id,
      page_index,
      activeTabId: ctx.getCurrentFilter()?.id,
      customFilterParams: JSON.stringify(customFilterParams),
    },
  })
}

function handleCopyId(ctx: OpCtx) {
  ctx.copyTextFn(ctx.data.dirId!)
  ctx.showToast(0, $t('复制成功'))
}

async function handleRestart(ctx: OpCtx) {
  const dirIds = ctx.datas.filter(item => item.openLimitStatus).toSorted((a, b) => a.windowSortNum! - b.windowSortNum!).map(item => item.dirId!)
  if (dirIds.length)
    globalThis.electronAPI.send('browser:batchRelaunch', dirIds)
}

function handleClose(ctx: OpCtx) {
  globalThis.electronAPI.send('browser:batchClose', ctx.datas.map((item: any) => item.dirId))
}

async function handleAddTag(ctx: OpCtx) {
  if (ctx.operationType === 'batch') {
    ctx.tagsIconRef.value?.openMenu(ctx.operate._event)
  }
  else {
    ctx.addTag({
      confirmNext: ({ params, res }: any) => {
        ctx.updateProfileMeta({
          labelInfo: [...ctx.data.labelInfo!, { labelColor: params.color, labelName: params.name, labelId: res.data.id }],
          labelIds: [...ctx.data.labelIds!, res.data.id],
          requestType: ProfileReqType.SelectLabel,
        }, ctx.data)
      },
    })
  }
}

function handleFav(ctx: OpCtx) {
  ctx.singleModifyWindow({ id: ctx.data.id, isOften: !ctx.data.isOften }, true)
    .then(() => {
      ctx.data.isOften = !ctx.data.isOften
    })
}

const operationMap: Record<string, (ctx: OpCtx) => void | Promise<void>> = {
  edit: handleEdit,
  copyId: handleCopyId,
  transfer: async ctx => ctx.onTransfer(ctx.datas, ctx.operate),
  moveToProject: async ctx => ctx.onMoveToProject(ctx.data),
  open: async ctx => ctx.openBrowserBefore(ctx.data),
  view: async ctx => ctx.openBrowserBefore(ctx.data),
  setAsDefaultBrowser: async ctx => ctx.setAsDefaultBrowser(ctx.data),
  createDesktopShortcut: async ctx => ctx.createDesktopShortcut(ctx.data),
  addProxy: async ctx => ctx.multipleProxyChange(ctx.data, { operationType: ctx.operationType, proxyMethod: 'custom' }),
  chooseProxy: async ctx => ctx.multipleProxyChange(ctx.data, { operationType: ctx.operationType, proxyMethod: 'choose' }),
  deleteProxy: async ctx => ctx.multipleProxyDelete(ctx.data),
  checkProxy: async ctx => ctx.onTestProxy(ctx.data),
  addPlatformAccount: async ctx => ctx.multipleAccountChange(ctx.data, { operationType: ctx.operationType, isChoose: false }),
  choosePlatformAccount: async ctx => ctx.multipleAccountChange(ctx.data, { operationType: ctx.operationType, isChoose: true }),
  restart: handleRestart,
  close: handleClose,
  addTag: handleAddTag,
  fav: handleFav,
  addNotes: async ctx => ctx.onRemark(ctx.data),
  editCookies: async ctx => ctx.onEditCookies(ctx.data),
  cookieRobot: async ctx => ctx.openCookieRobot(ctx.data),
  clearCache: async ctx => ctx.onClearCache(ctx.datas),
  exportProfile: async ctx => ctx.exportProfile(ctx.datas),
  delete: async ctx => ctx.deleteProfile(ctx.datas, ctx.ids),
}

export function createProfileOperationHandler(deps: ProfileOperationDeps) {
  return async function operationHandler(operate: any, data: any, operationType: 'single' | 'batch' = 'single') {
    const datas: ProfileOpData[] = [].concat(data).map(item => toRaw(item))
    const ids = datas.map(item => item.id!)

    deps.saveLocalTrack(operate.name)

    const fn = operationMap[operate.name]
    if (fn) {
      await fn({
        ...deps,
        operate,
        datas,
        ids,
        data,
        operationType,
      })
    }
  }
}
