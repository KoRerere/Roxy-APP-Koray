<script setup lang="tsx">
import { useAgentApi } from '../agent-api'
import type { SkillEntry, SkillRuntime, SkillValidationErrorCode } from '../agent-api'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import RxButton from '/@/components/rx-button/index.vue'
import RxToggleSwitch from '/@/components/rx-toggle-switch/index.vue'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import Empty from './components/empty.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { I18nT } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { compare } from 'compare-versions'
import { useUserStore } from '/@/stores/user'
import { useMcpDataStore } from '../pinia-store/mcp-data-store'

const toast = useToast()
const { listSkills, validateSkill, installSkill, uninstallSkill, enableSkill, disableSkill } = useAgentApi()
const { showMenu } = usePopupMenu()
const [, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()
const mcpDataStore = useMcpDataStore()

const skills = ref<SkillEntry[]>([])
const loading = ref(false)
const uninstallingSkill = ref<string>('')

type SkillTab = 'all' | 'user' | 'store'
const activeTab = ref<SkillTab>('all')
const tabs = computed<Array<{ key: SkillTab, label: string }>>(() => [
  { key: 'all', label: $t('全部') },
  { key: 'user', label: $t('用户') },
  { key: 'store', label: $t('商店') },
])

const filteredSkills = computed(() => {
  if (activeTab.value === 'all')
    return skills.value
  return skills.value.filter(skill => skill.source === activeTab.value)
})

function getSkillValidationErrorMessage(errorCode?: SkillValidationErrorCode, fallback?: string) {
  switch (errorCode) {
    case 'path-not-found':
      return $t('所选路径不存在')
    case 'invalid-source-type':
      return $t('请选择 skill 目录或 .zip 文件')
    case 'zip-extract-failed':
      return $t('压缩包解压失败，请检查 zip 文件是否损坏')
    case 'missing-skill-md':
      return $t('目录中缺少 SKILL.md 文件')
    case 'read-failed':
      return $t('无法读取 SKILL.md，请检查文件权限')
    case 'content-too-large':
      return $t('SKILL.md 文件过大')
    case 'missing-frontmatter':
      return $t('SKILL.md 缺少 YAML frontmatter')
    case 'invalid-yaml':
      return $t('SKILL.md frontmatter 不是合法 YAML')
    case 'frontmatter-not-mapping':
      return $t('SKILL.md frontmatter 必须是对象')
    case 'missing-name':
      return $t('SKILL.md frontmatter 缺少 name 字段')
    case 'missing-description':
      return $t('SKILL.md frontmatter 缺少 description 字段')
    default:
      return fallback || $t('Skill 校验失败')
  }
}

const missingRuntimeIds = ref<string[]>([])
const runtimeMap = computed<Record<string, SkillRuntime>>(() => {
  const map: Record<string, SkillRuntime> = {}
  if (compare(userStore.appVersion, '3.8.7', '>=')) {
    skills.value.forEach((skill) => {
      skill.runtimes.forEach((runtime) => {
        map[runtime.id] = runtime
      })
    })
  }
  return map
})

async function loadSkills() {
  loading.value = true
  try {
    const res = await listSkills()
    if (res.code === 0) {
      skills.value = res.data || []
      if (compare(userStore.appVersion, '3.8.7', '>=')) {
        missingRuntimeIds.value = skills.value.flatMap(skill => skill.missingRuntimeIds)
      }
    }
  }
  catch (error) {
    console.error('Failed to load skills:', error)
  }
  finally {
    loading.value = false
  }
}

async function selectZipSkill() {
  const sourcePath = await globalThis.electronAPI.send('dialog:selectFile', [
    { name: 'ZIP Files', extensions: ['zip'] },
    { name: 'All Files', extensions: ['*'] },
  ])

  if (sourcePath) {
    await validateAndInstall(sourcePath)
  }
}

async function selectDirectorySkill() {
  const sourcePath = await globalThis.electronAPI.send('dialog:selectDir')

  if (sourcePath) {
    await validateAndInstall(sourcePath)
  }
}

function handleInstall(event: MouseEvent) {
  showMenu(event, {
    model: [
      {
        label: $t('选择压缩包'),
        command: () => {
          void selectZipSkill()
        },
      },
      {
        label: $t('选择文件夹'),
        command: () => {
          void selectDirectorySkill()
        },
      },
    ],
  })
}

async function validateAndInstall(sourcePath: string) {
  const validateRes = await validateSkill(sourcePath)
  if (validateRes.code !== 0) {
    toast.add({
      severity: 'warn',
      summary: $t('校验失败'),
      detail: getSkillValidationErrorMessage(validateRes.errorCode, validateRes.msg),
      life: 5000,
    })
    return
  }

  await installSkill(sourcePath)
  await loadSkills()
}

async function handleUninstall(skill: SkillEntry) {
  if (uninstallingSkill.value)
    return
  uninstallingSkill.value = skill.name
  try {
    await uninstallSkill(skill.name)

    // 删除成功后，直接从响应式状态中移除，避免重新加载
    if (mcpDataStore.userSkills) {
      const index = mcpDataStore.userSkills.findIndex(s => s.slug === skill.name)
      if (index !== -1) {
        mcpDataStore.userSkills.splice(index, 1)
      }
    }

    await loadSkills()
    // 如果是商店安装的 skill，同步更新商店的 userSkills 缓存
    if (skill.source === 'store') {
      mcpDataStore.invalidateUserSkills()
      await mcpDataStore.fetchUserSkills()
    }
  }
  catch (error) {
    onlyErrorToast(-1, $t('卸载失败'))
    return Promise.reject(error)
  }
  finally {
    uninstallingSkill.value = ''
  }
}

async function handleToggleEnabled(skill: SkillEntry, newValue: boolean) {
  try {
    const res = newValue ? await enableSkill(skill.name) : await disableSkill(skill.name)
    if (res.code !== 0) {
      onlyErrorToast(-1, res.msg || $t('操作失败'))
      return false
    }
    skill.enabled = newValue
  }
  catch (error) {
    onlyErrorToast(-1, $t('操作失败'))
    return false
  }
}

onMounted(() => {
  loadSkills()
})
</script>

<template>
  <div class="h-full flex flex-col gap-5">
    <div v-if="missingRuntimeIds.length > 0" class="pr-10 flex flex-col gap-2">
      <div
        v-for="runtime in missingRuntimeIds"
        :key="runtime"
        class="w-full flex items-center justify-between gap-2 text-3 rounded-md bg-[var(--component-alert-bg-warn)] p-3 font-500"
      >
        <span class="text-[var(--colors-text-text-primary)]">{{ $t('{command} 未安装。部分技能无法执行。', { command: runtime }) }}</span>
        <a :href="runtimeMap[runtime]?.homepage" target="_brank" class="text-[var(--colors-text-text-brand)] cursor-pointer">{{ $t('下载') }}</a>
      </div>
    </div>

    <div class="flex items-center justify-between pr-10">
      <div class="font-['Archivo'] text-5 font-semibold text-[var(--colors-text-text-primary)]">
        Skills
      </div>
      <div class="relative">
        <RxButton
          :label="$t('新建')"
          icon="base/rx_ic_plus"
          size="md"
          @click="handleInstall"
        />
      </div>
    </div>

    <!-- All / User / Store 分段标签 -->
    <div class="flex items-center">
      <div class="flex items-center gap-1 p-1 rounded-2 bg-[var(--component-segment-bg-selection,#ebf1f5)]">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center h-[30px] px-3 rounded-1.5 cursor-pointer text-3.5 font-medium transition-colors"
          :class="activeTab === tab.key
            ? 'bg-[var(--component-segment-bg-selection-active,white)] text-[var(--colors-text-text-primary)]'
            : 'text-[var(--colors-text-text-tertiary)] hover:text-[var(--colors-text-text-primary)]'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </div>
      </div>
    </div>

    <div class="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto pr-10 pb-10">
      <div
        v-for="skill in filteredSkills"
        :key="skill.name"
        class="flex flex-col gap-3 rounded-2 bg-[var(--colors-background-bg-block)] px-4 py-10px"
      >
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between gap-3">
            <div class="font-['Inter'] text-[14px] leading-20px font-700 text-[var(--colors-text-text-primary)]">
              {{ skill.title || skill.name }}
            </div>
            <RxToggleSwitch
              :model-value="skill.enabled"
              class="-ml-2 -mr-1 scale-70"
              :before-change="(val: boolean) => handleToggleEnabled(skill, val)"
            />
          </div>

          <div
            v-tooltip.top="{ value: skill.description, showDelay: 1000 }"
            class="line-clamp-3 font-['Inter'] text-[14px] leading-20px text-[var(--colors-text-text-primary)]"
          >
            {{ skill.description }}
          </div>
        </div>

        <div class="h-px w-full bg-[var(--colors-border-border-inactive)]" />

        <div class="flex items-center justify-between">
          <div class="font-['Inter'] text-3 text-[var(--colors-text-text-inactive)]">
            {{ $t('来源') }}: {{ skill.source === 'store' ? $t('商店') : $t('用户') }}
          </div>
          <button
            class="flex cursor-pointer items-center gap-1 rounded-1 border-none bg-transparent px-1.5 py-1 outline-none"
            :disabled="uninstallingSkill === skill.name"
            @click="handleUninstall(skill)"
          >
            <SvgIcon :name="uninstallingSkill === skill.name ? 'base/rx_ic_spin-1' : 'base/rx_ic_bin_1'" size="16" :color="uninstallingSkill === skill.name ? 'var(--colors-text-text-inactive)' : 'var(--colors-icon-icon-primary)'" />
            <span class="font-['Inter'] text-3 font-medium" :class="uninstallingSkill === skill.name ? 'text-[var(--colors-text-text-inactive)]' : 'text-[var(--colors-text-text-primary)]'">
              {{ $t('删除') }}
            </span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="py-2 text-center text-sm text-gray-500">
        {{ $t('加载中...') }}
      </div>
      <template v-else-if="filteredSkills.length === 0">
        <Empty icon="base/rx_ic_fix" :title="$t('暂无 Skills')">
          <I18nT :keypath="$t('关于 Skills 的信息与配置方法，请访问 {skills}', { skills: '{skills}' })">
            <template #skills>
              <a href="https://agentskills.io/home" target="_blank" class="text-[var(--colors-text-text-brand)] underline">
                {{ $t('Skills 介绍') }}
              </a>
            </template>
          </I18nT>
        </Empty>
      </template>
    </div>
  </div>
</template>
