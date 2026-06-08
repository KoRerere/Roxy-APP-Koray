import { defineStore } from 'pinia'
import { API } from '/@/api'
import { useAgentStore } from '/@/stores/agent'
import { useAgentApi } from '/@/views/mcp/agent-api'
import { AgentAPI } from '/@/views/mcp/api'
import type { UserModelInfo, UserModelOption, UserModelType } from '/@/views/mcp/agent-api'
import { AUTOMATION_MODEL_TYPE } from '/@/views/mcp/model-config'

// ============ Skills Store 类型定义 ============

export interface SkillCategory {
  id: number
  slug: string
  name: string | null
  iconInfo?: SkillCategoryIconInfo | null
  sort_order: number
  enabled: 0 | 1
}

export interface SkillCategoryThemeValue {
  dark?: string | null
  light?: string | null
}

export interface SkillCategoryIconInfo {
  icon?: SkillCategoryThemeValue | null
  bgColor?: SkillCategoryThemeValue | null
  primaryColor?: SkillCategoryThemeValue | null
}

export interface StoreSkill {
  id: number
  category_id: number
  category_name: string | null
  category_slug: string | null
  slug: string
  name: string
  title: string | null
  description: string | null
  icon_url: string | null
  version: number
  release_notes: string | null
  meta: Record<string, unknown> | null
  file_url: string | null
  published: 0 | 1
}

export interface UserSkill extends StoreSkill {
  installed_version: number
  has_update: boolean
  installed_at: string | null
  enabled: boolean | 0 | 1
  user_skill_id: number
}

export const useMcpDataStore = defineStore('mcpData', () => {
  const agentApi = useAgentApi()
  const agentStore = useAgentStore()

  // ============ Prompt 预设 ============
  const promptPresets = ref<any[] | null>(null)
  const promptPresetsLoading = ref(false)

  async function fetchPromptPresets(force = false) {
    if (promptPresets.value && !force)
      return promptPresets.value
    promptPresetsLoading.value = true
    try {
      const { code, data } = await API.base.userGetPromptTemplateListList()
      if (code === 0) {
        promptPresets.value = data
      }
      return data
    }
    finally {
      promptPresetsLoading.value = false
    }
  }

  // ============ Skills Store 分类 ============
  const categories = ref<SkillCategory[] | null>(null)

  async function fetchCategories(force = false) {
    if (categories.value && !force)
      return categories.value
    try {
      const res = await AgentAPI.skills.listSkillCategoriesV1SkillCategoriesGet()
      if (res.code === 0) {
        categories.value = (res.data || []).filter((c: SkillCategory) => c.enabled)
      }
      return categories.value
    }
    catch (e) {
      console.error('Failed to load categories:', e)
      return null
    }
  }

  // ============ Skills Store 技能列表（全量缓存，分类前端过滤） ============
  const skillsMap = ref<Record<string, StoreSkill[]>>({})
  const skillsLoading = ref(false)

  async function fetchSkills(category?: string, force = false) {
    const cacheKey = '__all__'
    if (!skillsMap.value[cacheKey] || force) {
      skillsLoading.value = true
      try {
        const res = await AgentAPI.skills.listSkillsV1SkillsGet({})
        if (res.code === 0) {
          skillsMap.value[cacheKey] = res.data || []
        }
      }
      catch (e) {
        console.error('Failed to load skills:', e)
        return null
      }
      finally {
        skillsLoading.value = false
      }
    }

    const allSkills = skillsMap.value[cacheKey] || []
    if (!category)
      return allSkills

    return allSkills.filter(skill => skill.category_slug === category)
  }

  // ============ Skills Store 用户已安装技能 ============
  const userSkills = ref<UserSkill[] | null>(null)

  async function fetchUserSkills(force = false) {
    if (userSkills.value && !force)
      return userSkills.value
    try {
      const res = await AgentAPI.skills.listUserSkillsV1UserSkillsGet()
      if (res.code === 0) {
        userSkills.value = res.data || []
      }
      return userSkills.value
    }
    catch (e) {
      console.error('Failed to load user skills:', e)
      return null
    }
  }

  /** 安装/卸载后清除缓存，强制下次重新获取 */
  function invalidateUserSkills() {
    userSkills.value = null
  }

  // ============ User Model 缓存 ============
  const userModel = ref<UserModelInfo | null>(null)
  const userModelLoaded = ref(false)
  const userModelLoading = ref(false)
  const modelOptionsMap = ref<Partial<Record<UserModelType, UserModelOption[]>>>({})
  const modelOptionsLoaded = ref<Partial<Record<UserModelType, boolean>>>({})
  const modelOptionsLoading = ref<Partial<Record<UserModelType, boolean>>>({})
  const cachedModelServerUrl = ref('')

  let agentReadyPromise: Promise<void> | null = null
  let userModelRequest: Promise<UserModelInfo | null> | null = null
  const modelOptionsRequests = new Map<UserModelType, Promise<UserModelOption[] | null>>()

  function resetUserModelCache() {
    userModel.value = null
    userModelLoaded.value = false
    userModelLoading.value = false
    modelOptionsMap.value = {}
    modelOptionsLoaded.value = {}
    modelOptionsLoading.value = {}
    userModelRequest = null
    modelOptionsRequests.clear()
  }

  function ensureModelServerScope() {
    const nextServerUrl = agentStore.serverUrl || ''
    if (cachedModelServerUrl.value === nextServerUrl)
      return

    cachedModelServerUrl.value = nextServerUrl
    resetUserModelCache()
  }

  async function waitForAgentReady(timeout = 15000) {
    ensureModelServerScope()

    // 确保健康检查在运行：若此前被停止（如离开页面后再进入），重启会把 isOk 复位，
    // 从而杜绝拿上一次遗留的 isOk=true 在「本次」/health 成功前就放行请求。
    agentStore.startHealthCheck()

    // 唯一就绪依据：serverUrl 已就绪且本次 /health 成功（isReady）。
    if (agentStore.isReady)
      return

    if (agentReadyPromise)
      return agentReadyPromise

    agentReadyPromise = new Promise<void>((resolve, reject) => {
      const stop = watch(
        () => agentStore.isReady,
        (ready) => {
          if (ready) {
            cleanup()
            resolve()
          }
        },
        { immediate: true },
      )

      const timer = window.setTimeout(() => {
        cleanup()
        reject(new Error('Agent is not ready'))
      }, timeout)

      function cleanup() {
        stop()
        window.clearTimeout(timer)
        agentReadyPromise = null
      }
    })

    return agentReadyPromise
  }

  async function fetchUserModel(force = false) {
    ensureModelServerScope()
    if (userModelLoaded.value && !force)
      return userModel.value
    if (userModelRequest)
      return userModelRequest

    userModelLoading.value = true
    userModelRequest = (async () => {
      await waitForAgentReady()
      const res = await agentApi.getUserModel()
      if (res.code === 0) {
        userModel.value = res.data
        userModelLoaded.value = true
        return userModel.value
      }
      throw new Error(res.msg || res.message || 'Failed to load user model')
    })()
      .catch((error) => {
        console.error('Failed to load user model:', error)
        return null
      })
      .finally(() => {
        userModelLoading.value = false
        userModelRequest = null
      })

    return userModelRequest
  }

  async function fetchModelOptions(modelType: UserModelType, force = false) {
    ensureModelServerScope()
    if (modelOptionsLoaded.value[modelType] && !force)
      return modelOptionsMap.value[modelType] || []

    const inflight = modelOptionsRequests.get(modelType)
    if (inflight)
      return inflight

    modelOptionsLoading.value = {
      ...modelOptionsLoading.value,
      [modelType]: true,
    }

    const request = (async () => {
      await waitForAgentReady()
      const res = await agentApi.listUserModelOptions(modelType)
      if (res.code === 0) {
        modelOptionsMap.value = {
          ...modelOptionsMap.value,
          [modelType]: res.data?.items || [],
        }
        modelOptionsLoaded.value = {
          ...modelOptionsLoaded.value,
          [modelType]: true,
        }
        return modelOptionsMap.value[modelType] || []
      }
      throw new Error(res.msg || res.message || `Failed to load ${modelType} options`)
    })()
      .catch((error) => {
        console.error(`Failed to load model options for ${modelType}:`, error)
        return null
      })
      .finally(() => {
        modelOptionsLoading.value = {
          ...modelOptionsLoading.value,
          [modelType]: false,
        }
        modelOptionsRequests.delete(modelType)
      })

    modelOptionsRequests.set(modelType, request)
    return request
  }

  async function prefetchAutomationModelData(force = false) {
    await Promise.all([
      fetchUserModel(force),
      fetchModelOptions(AUTOMATION_MODEL_TYPE, force),
    ])
  }

  async function switchUserModel(modelType: UserModelType, model: string | null) {
    ensureModelServerScope()
    await waitForAgentReady()

    const res = await agentApi.switchUserModel(modelType, model)
    if (res.code === 0) {
      userModel.value = res.data
      userModelLoaded.value = true
    }
    return res
  }

  watch(() => agentStore.serverUrl, () => {
    ensureModelServerScope()
  }, { immediate: true })

  return {
    // prompt presets
    promptPresets,
    promptPresetsLoading,
    fetchPromptPresets,
    // skills store
    categories,
    skillsMap,
    userSkills,
    skillsLoading,
    fetchCategories,
    fetchSkills,
    fetchUserSkills,
    invalidateUserSkills,
    // user model
    userModel,
    userModelLoaded,
    userModelLoading,
    modelOptionsMap,
    modelOptionsLoaded,
    modelOptionsLoading,
    fetchUserModel,
    fetchModelOptions,
    prefetchAutomationModelData,
    switchUserModel,
    resetUserModelCache,
    waitForAgentReady,
  }
}, {
  persist: false,
})
