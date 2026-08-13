import { h, toRaw } from 'vue'
import QuickCreateEditor from '/@/views/browser/create/quick.vue'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { filterFieldByValue, getFormDataByList, isEmptyValue } from '/@/utils'
import { emitter } from '/@/utils/eventBus'
import { ceateRandomFinger, getInputsGroup } from '/@/views/browser/create/form-inputs'
import { ensureApiExtractProxyInfo } from '/@/views/browser/create/components/proxy-info/api-extract'
import { toSingleWindowProxyParams } from '/@/views/browser/create/components/proxy-info/proxy-params'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { useCheckProxy } from '/@/views/agent/hooks'
import type { WindowMetaData } from '/@/views/browser/create/components/type'

/** 快速创建模板记录（每用户至多一条） */
export interface QuickCreateTemplateRecord {
  id: number
  templateInfo: Record<string, any>
}

/**
 * 快速创建成功后是否自动打开窗口。
 * 当前默认关闭；后续改为读取用户设置字段。
 */
function shouldAutoOpenAfterQuickCreate() {
  return false
}

/**
 * 快速创建入口与模板读写；暂仅 owner，后续可改为权限码。
 * 主按钮：无模板用默认配置建窗；有模板按模板建窗。默认不打开。齿轮：编辑模板。
 */
export function useQuickCreate() {
  const { isOwner } = storeToRefs(useRoleStore())
  const userStore = useUserStore()
  const { fetchUserInfo } = userStore
  const { userConfig, userPayInfo } = storeToRefs(userStore)
  const { getWorkspaceList } = useWorkspaceStore()
  const { getProjects } = useMateGroup()
  const { handleBusinessCode } = useHandleBusinessCode()
  const { testProxy } = useCheckProxy()
  const [, onlyErrorToast] = useResponseToast()
  const [showModal] = useDialog()

  /** 暂仅 owner，后续可改为 check('Profiles_quick_create') 等 */
  function canQuickCreate() {
    return isOwner.value
  }

  /** 查询当前用户快速创建模板；无数据时 data 为 null */
  async function fetchQuickCreateTemplate(): Promise<QuickCreateTemplateRecord | null> {
    const { code, data, msg } = await API.window.userGetQuickCreateTemplateList()
    onlyErrorToast(code, msg)
    if (code !== 0 || !data)
      return null

    return {
      id: data.id,
      // 读库即归一：旧模板里的 proxyInfoList 只用于补齐扁平，不再作为事实源带回
      templateInfo: toSingleWindowProxyParams(
        (data.templateInfo && typeof data.templateInfo === 'object')
          ? data.templateInfo as Record<string, any>
          : {},
      ),
    }
  }

  /**
   * 新增或覆盖唯一模板；body 为表单 JSON 整包。
   */
  async function saveQuickCreateTemplate(formData: Record<string, any>, templateId?: number) {
    // 模板只存扁平代理字段，与编辑页/单窗 API 对齐
    const payload = toSingleWindowProxyParams(formData)
    const { code, msg } = templateId
      ? await API.window.userMdfQuickCreateTemplateCreate({ id: templateId, ...payload })
      : await API.window.userAddQuickCreateTemplateCreate(payload)

    onlyErrorToast(code, msg)
    return code === 0
  }

  /** 创建时注入默认项目，不展示 MateGroup */
  async function resolveDefaultMetaData(): Promise<WindowMetaData> {
    const projects = await getProjects()
    const target = projects.find(item => item.projectDefault) ?? projects[0]
    return {
      projectName: target?.label || $t('未指定项目'),
      projectId: target ? Number(target.value) : undefined,
      labelIds: [],
      windowRemark: '',
      projectDefault: target ? 1 : 0,
    }
  }

  async function checkWindowTotalCountOk() {
    const { code, msg } = await API.window.userCheckWindowTotalCountList()
    if (code !== 0) {
      handleBusinessCode(code, () => onlyErrorToast(code, msg))
      return false
    }
    return true
  }

  /**
   * 按表单/模板数据建窗；每次重新生成指纹。
   * 是否打开由 shouldAutoOpenAfterQuickCreate 控制，调用方可显式覆盖。
   */
  async function createAndOpenFromFormData(
    formDataInput: Record<string, any>,
    options?: { openAfterCreate?: boolean },
  ) {
    const isOk = await checkWindowTotalCountOk()
    if (!isOk)
      return false

    const [inputsGroup, original] = await getInputsGroup(formDataInput)
    const fingerData = await ceateRandomFinger(inputsGroup)
    Object.assign(original, fingerData[0])

    const metaData = await resolveDefaultMetaData()
    const filteredMetadata = filterFieldByValue(toRaw(metaData), value => !isEmptyValue(value))
    const formData = getFormDataByList(inputsGroup, filteredMetadata)
    const params = toSingleWindowProxyParams({
      createCount: 1,
      ...toRaw(original),
      ...formData,
    })

    const ensured = toSingleWindowProxyParams(await ensureApiExtractProxyInfo(params, {
      checkChannel: userConfig.value.ipChecker,
      isDirect: userPayInfo.value.isDirectWhitelist,
      testProxy,
    }))

    const { code, data, msg } = await API.window.userAddWindowInfoV2Create(ensured as any)
    onlyErrorToast(code, msg)
    if (code !== 0)
      return false

    getWorkspaceList()
    fetchUserInfo()
    const openAfterCreate = options?.openAfterCreate ?? shouldAutoOpenAfterQuickCreate()
    // 传入 windowId 会走列表 autoOpenBrowser；关闭时仍刷新列表
    emitter.emit('refreshProfileList', openAfterCreate ? data?.windowId : undefined)
    return true
  }

  async function openQuickCreateEditor() {
    const record = await fetchQuickCreateTemplate()

    return showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        root: { class: 'quick-create-dialog' },
        content: { class: '!pa-0 !overflow-hidden' },
      },
      slots: {
        container: ({ hideModal }) => h(QuickCreateEditor, {
          template: record?.templateInfo ?? {},
          onClose: hideModal,
          onSaved: async (payload: { formData: Record<string, any>, createAndRun: boolean }) => {
            const ok = await saveQuickCreateTemplate(payload.formData, record?.id)
            if (!ok)
              throw new Error('Failed to save quick create template')

            hideModal()

            if (payload.createAndRun)
              await createAndOpenFromFormData(payload.formData)
          },
        }),
      },
    })
  }

  /** 主按钮：无模板用默认配置建窗；有模板按模板建窗。不弹编辑器 */
  async function onQuickCreateMainClick() {
    if (!(await checkWindowTotalCountOk()))
      return

    const record = await fetchQuickCreateTemplate()
    await createAndOpenFromFormData(record?.templateInfo ?? {})
  }

  /** 齿轮：编辑已存模板（无模板时等同首次配置） */
  async function onQuickCreateSettingsClick() {
    await openQuickCreateEditor()
  }

  return {
    canQuickCreate,
    fetchQuickCreateTemplate,
    saveQuickCreateTemplate,
    createAndOpenFromFormData,
    openQuickCreateEditor,
    onQuickCreateMainClick,
    onQuickCreateSettingsClick,
  }
}
