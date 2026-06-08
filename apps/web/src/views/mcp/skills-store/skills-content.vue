<script setup lang="ts">
import { useAgentApi } from '../agent-api'
import { useOpenRoxyAIAgent } from '/@/hooks/useOpenRoxyAIAgent'
import { useResponseToast } from '/@/hooks/useResponseToast'
// import { useToast } from 'primevue/usetoast'
import Empty from '../settings/components/empty.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { useMcpDataStore } from '../pinia-store/mcp-data-store'
import type { SkillCategory, SkillCategoryThemeValue, StoreSkill } from '../pinia-store/mcp-data-store'
import { useChatStreamStore } from '../pinia-store/useChatStreamStore'
import { useRouter } from 'vue-router'
import { useThemeStore } from '/@/stores/theme'
import { getHexWithAlpha } from '../utils'
import { skillsCommand } from '../config.ts'

// const emit = defineEmits<{
//   (e: 'goToSkills'): void
// }>()

withDefaults(defineProps<{
  type?: 'agent' | 'app'
}>(), {
  type: 'agent',
})

const router = useRouter()
const chatStore = useChatStreamStore()
const themeStore = useThemeStore()

const store = useMcpDataStore()
const { storeInstallSkill, storeRemoveSkill } = useAgentApi()
const { openRoxyAIAgent } = useOpenRoxyAIAgent()
const [, onlyErrorToast] = useResponseToast()
// const toast = useToast()

// function handleGoToSkills() {
//   toast.removeGroup('skill-installed')
//   emit('goToSkills')
// }

const categories = computed(() => store.categories || [])
const userSkills = computed(() => store.userSkills || [])
const categoryMap = computed<Record<string, SkillCategory>>(() => Object.fromEntries(
  categories.value.map(category => [category.slug, category]),
))
const activeCategory = ref<string>('')
const filterStatus = ref<string>('all')
const installingSlug = ref<string>('')

/** 当前分类对应的技能列表 */
const skills = computed(() => {
  const allSkills = store.skillsMap.__all__ || []
  if (!activeCategory.value)
    return allSkills

  return allSkills.filter(skill => skill.category_slug === activeCategory.value)
})

/** 技能加载中（只看全量列表是否已完成首屏加载） */
const loading = computed(() => {
  return !store.skillsMap.__all__ && store.skillsLoading
})

const filterOptions = computed(() => [
  { label: $t('全部'), value: 'all' },
  { label: $t('已安装'), value: 'installed' },
  { label: $t('未安装'), value: 'not_installed' },
])

const installedSlugs = computed(() => new Set(userSkills.value.map(s => s.slug)))

const filteredSkills = computed(() => {
  if (!filterStatus.value || filterStatus.value === 'all') {
    return skills.value
  }
  else if (filterStatus.value === 'installed') {
    return skills.value.filter(s => installedSlugs.value.has(s.slug))
  }
  else {
    return skills.value.filter(s => !installedSlugs.value.has(s.slug))
  }
})

function isInstalled(slug: string) {
  return installedSlugs.value.has(slug)
}

function pickThemeValue(value?: SkillCategoryThemeValue | null) {
  if (!value)
    return ''
  return themeStore.realTheme === 'dark'
    ? (value.dark || value.light || '')
    : (value.light || value.dark || '')
}

function getCategoryIcon(skill: Pick<StoreSkill, 'category_slug'>) {
  return pickThemeValue(categoryMap.value[skill.category_slug || '']?.iconInfo?.icon)
}

function getCategoryBgColor(skill: Pick<StoreSkill, 'category_slug'>) {
  return pickThemeValue(categoryMap.value[skill.category_slug || '']?.iconInfo?.bgColor) || 'var(--colors-background-bg-action)'
}

function getCategoryPrimaryColor(skill: Pick<StoreSkill, 'category_slug'>) {
  return pickThemeValue(categoryMap.value[skill.category_slug || '']?.iconInfo?.primaryColor) || 'var(--colors-icon-icon-brand)'
}

async function handleInstall(skill: StoreSkill) {
  if (installingSlug.value)
    return
  installingSlug.value = skill.slug
  try {
    // 走 Agent 本地接口：除了在后端记录安装，还会真正把 skill 文件下载到 Agent
    const res = await storeInstallSkill(skill.slug)
    if (res.code === 0) {
      // 安装成功后，直接添加到响应式状态中
      if (store.userSkills) {
        // 将 StoreSkill 转换为 UserSkill 格式并添加
        const userSkill = {
          ...skill,
          installed_version: skill.version,
          has_update: false,
          installed_at: new Date().toISOString(),
          enabled: true,
          user_skill_id: res.data?.userSkill?.user_skill_id || Date.now(), // 使用返回的 ID 或临时 ID
        }
        store.userSkills.push(userSkill)
      }
      else {
        // 如果 userSkills 为空，则重新获取
        await store.fetchUserSkills()
      }
    }
    else {
      onlyErrorToast(-1, res.msg || $t('安装失败'))
    }
  }
  catch (e: any) {
    onlyErrorToast(-1, e.message || $t('安装失败'))
  }
  finally {
    installingSlug.value = ''
  }
}

async function handleRemove(skill: StoreSkill) {
  if (installingSlug.value)
    return
  installingSlug.value = skill.slug
  try {
    // 走 Agent 本地接口：除了在后端移除记录，还会把本地下载的 skill 文件一并卸载
    const res = await storeRemoveSkill(skill.slug)
    if (res.code === 0) {
      // 卸载成功后，直接从响应式状态中移除，避免缓存问题
      if (store.userSkills) {
        const index = store.userSkills.findIndex(s => s.slug === skill.slug)
        if (index !== -1) {
          store.userSkills.splice(index, 1)
        }
      }
    }
    else {
      onlyErrorToast(-1, res.msg || $t('卸载失败'))
    }
  }
  catch (e: any) {
    onlyErrorToast(-1, e.message || $t('卸载失败'))
  }
  finally {
    installingSlug.value = ''
  }
}

function selectCategory(slug: string) {
  activeCategory.value = slug
}

function handleUseSkill(skill: StoreSkill) {
  if (chatStore.isChatting) {
    onlyErrorToast(-1, $t('任务进行中，不可操作'))
    return
  }

  // 重置聊天状态
  chatStore.resetChat()

  // 跳转到聊天页面
  router.push('/mcp/chat')

  // 使用 nextTick 确保路由跳转完成后再设置消息
  nextTick(() => {
    const skillName = skill.name
    chatStore.userMessage = skillsCommand[skill.slug] || $t('使用 `{skillName}` 技能，帮我完成 ', { skillName })
    chatStore.inputScene = 'automation'
  })
}

/**
 * App 端「去使用」：经 useOpenRoxyAIAgent 打开 Agent 窗口（含权限/RoxyClaw/API 等前置校验），并把 skill 带过去。
 * 注意：技能下载需要 Agent 本地接口，必须 Agent 启动后才能进行，因此下载在 Agent 窗口侧完成（见 mcp/index.vue）。
 * - 窗口未打开：新开窗口，由 mcp/index.vue 读取 URL 上的 skill，确保下载后预填消息。
 * - 窗口已打开：主进程发 mcp:use-skill 给 Agent 窗口，由其判断对话中则提示、否则确保下载后新开会话预填。
 *
 * 传递 slug 而非 name：slug 是技术标识（下载用），name 是展示名（由 Agent 从 slug 查询获得）。
 */
function handleUseSkillByApp(skill: StoreSkill) {
  openRoxyAIAgent(undefined, skill.slug)
}

onMounted(async () => {
  await Promise.all([
    store.fetchCategories(),
    store.fetchSkills(),
    store.fetchUserSkills(),
  ])
})
</script>

<template>
  <!-- 内容区 -->
  <div class="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
    <!-- 分类标签栏 -->
    <div class="flex items-center justify-between sticky top-0 bg-[var(--colors-background-bg-page)] py-6">
      <div class="flex items-center gap-1 p-1 rounded-2 bg-[var(--component-segment-bg-selection)]">
        <div
          class="flex items-center h-[30px] px-3 rounded-1.5 cursor-pointer text-14px font-500 transition-colors"
          :class="activeCategory === ''
            ? 'bg-[var(--component-segment-bg-selection-active,white)] text-[var(--colors-text-text-primary)]'
            : 'text-[var(--colors-text-text-tertiary)] hover:text-[var(--colors-text-text-primary)]'"
          @click="selectCategory('')"
        >
          {{ $t('全部') }}
        </div>
        <div
          v-for="cat in categories"
          :key="cat.slug"
          class="flex items-center gap-1.5 h-[30px] px-3 rounded-1.5 cursor-pointer text-14px font-500 transition-colors"
          :class="activeCategory === cat.slug
            ? 'bg-[var(--component-segment-bg-selection-active,white)] text-[var(--colors-text-text-primary)]'
            : 'text-[var(--colors-text-text-tertiary)] hover:text-[var(--colors-text-text-primary)]'"
          @click="selectCategory(cat.slug)"
        >
          {{ cat.name || cat.slug }}
        </div>
      </div>

      <!-- 筛选 -->
      <RxInputSelect
        v-if="type === 'agent'"
        v-model="filterStatus"
        name="skills-store-filter"
        class="!w-30"
        :filter="false"
        size="md"
        :options="filterOptions"
        option-label="label"
        option-value="value"
      />
    </div>

    <div>
      <!-- Skills 卡片网格 -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="text-sm text-[var(--colors-text-text-inactive)]">
          {{ $t('加载中...') }}
        </div>
      </div>

      <div v-else-if="filteredSkills.length === 0">
        <Empty icon="base/rx_ic_fix" :title="$t('暂无 Skills')" />
      </div>

      <div v-else class="grid auto-rows-fr gap-4" :class="[type === 'agent' ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-3']">
        <RxTooltip
          v-for="skill in filteredSkills"
          :key="skill.slug"
          class="h-full w-full"
          :delay="800"
        >
          <div
            class="flex h-full w-full gap-3 items-start overflow-hidden rounded-3 bg-[var(--colors-background-bg-block)] p-3"
          >
            <!-- Icon -->
            <div
              class="size-10 shrink-0 rounded-2 overflow-hidden flex items-center justify-center"
              :style="{
                background: getCategoryIcon(skill) ? getCategoryBgColor(skill) : 'white',
                border: `1px solid ${getHexWithAlpha(getCategoryPrimaryColor(skill), 15)}`,
              }"
            >
              <img
                :src="getCategoryIcon(skill)"
                :alt="skill.name"
                class="size-6 object-contain"
              >
            </div>

            <!-- Content -->
            <div class="flex h-full min-w-0 flex-1 flex-col gap-3">
              <div class="flex flex-col gap-1">
                <div class="text-[14px] leading-5 font-bold text-[var(--colors-text-text-primary)] line-clamp-2">
                  {{ skill.title || skill.name }}
                </div>
                <div class="text-3 leading-[20px] text-[var(--colors-text-text-tertiary)] line-clamp-3">
                  {{ skill.description }}
                </div>
              </div>

              <!-- Footer -->
              <div class="mt-auto flex items-center justify-end">
                <!-- <div class=" text-3 text-[var(--colors-text-text-inactive)]">
                  {{ $t('创建者') }}: Roxy
                </div> -->

                <!-- Install / Installed -->
                <template v-if="type === 'agent'">
                  <div v-if="isInstalled(skill.slug)" class="flex gap-1 items-center">
                    <button
                      class="flex items-center gap-1 px-1.5 py-1 rounded-1 min-w-[56px] justify-center border-none bg-transparent cursor-pointer outline-none"
                      :disabled="installingSlug === skill.slug"
                      @click="handleRemove(skill)"
                    >
                      <SvgIcon :name="installingSlug === skill.slug ? 'base/rx_ic_spin-1' : 'base/rx_ic_bin_1'" size="16" color="var(--colors-text-text-inactive)" />
                      <span class=" text-3 font-medium text-center">
                        {{ $t('卸载') }}
                      </span>
                    </button>

                    <button
                      class="flex items-center gap-1 px-1.5 py-1 rounded-1 min-w-[56px] justify-center border-none bg-transparent cursor-pointer outline-none text-[var(--colors-text-text-brand)]"
                      :disabled="installingSlug === skill.slug"
                      @click="handleUseSkill(skill)"
                    >
                      <SvgIcon name="base/rx_ic_message" size="16" color="var(--colors-text-text-brand)" />
                      <span class=" text-3 font-medium text-center">
                        {{ $t('去使用') }}
                      </span>
                    </button>
                  </div>

                  <button
                    v-else
                    class="flex items-center gap-1 px-1.5 py-1 rounded-1 min-w-[56px] justify-center border-none bg-transparent cursor-pointer outline-none"
                    :disabled="installingSlug === skill.slug"
                    @click="handleInstall(skill)"
                  >
                    <SvgIcon :name="installingSlug === skill.slug ? 'base/rx_ic_spin-1' : 'base/rx_ic_download_cloud'" size="16" color="var(--colors-text-text-brand)" />
                    <span class="text-3 font-medium text-center" :class="installingSlug === skill.slug ? 'text-[var(--colors-text-text-inactive)]' : 'text-[var(--colors-text-text-brand)]'">
                      {{ $t('安装') }}
                    </span>
                  </button>
                </template>
                <button
                  v-else
                  class="flex items-center gap-1 px-1.5 py-1 rounded-1 min-w-[56px] justify-center border-none bg-transparent cursor-pointer outline-none text-[var(--colors-text-text-brand)]"
                  :disabled="installingSlug === skill.slug"
                  @click="handleUseSkillByApp(skill)"
                >
                  <SvgIcon name="base/rx_ic_message" size="16" color="var(--colors-text-text-brand)" />
                  <span class=" text-3 font-medium text-center">
                    {{ $t('去使用') }}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <template #content>
            <div class="max-w-[320px] text-white text-3">
              {{ skill.description }}
            </div>
          </template>
        </RxTooltip>
      </div>
    </div>
  </div>
</template>
