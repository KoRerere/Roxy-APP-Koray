<script setup lang="tsx">
import { useAgentApi } from '../agent-api'
import type { SkillEntry, SkillRuntime, SkillValidationErrorCode } from '../agent-api'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import RxButton from '/@/components/rx-button/index.vue'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import Empty from './components/empty.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { I18nT } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { compare } from 'compare-versions'
import { useUserStore } from '/@/stores/user'

const toast = useToast()
const { listSkills, validateSkill, installSkill, uninstallSkill } = useAgentApi()
const { showMenu } = usePopupMenu()
const [, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()

const skills = ref<SkillEntry[]>([])
const loading = ref(false)

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
  try {
    await uninstallSkill(skill.name)
    await loadSkills()
  }
  catch (error) {
    onlyErrorToast(-1, $t('卸载失败'))
    return Promise.reject(error)
  }
}

onMounted(() => {
  loadSkills()
})
</script>

<template>
  <div class="h-full flex flex-col gap-5" style="will-change: transform;">
    <div v-if="missingRuntimeIds.length > 0" class=" flex flex-col gap-2">
      <div
        v-for="runtime in missingRuntimeIds"
        :key="runtime"
        class="w-full flex items-center justify-between gap-2 text-3 rounded-md bg-[var(--component-alert-bg-warn)] p-3 font-500"
      >
        <span class="text-[var(--colors-text-text-primary)]">{{ $t('{command} 未安装。部分技能无法执行。', { command: runtime }) }}</span>
        <a :href="runtimeMap[runtime]?.homepage" target="_brank" class="text-[var(--colors-text-text-brand)] cursor-pointer">{{ $t('下载') }}</a>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <div class="font-['Archivo'] text-6 font-semibold text-[var(--colors-text-text-primary)]">
        Skills
      </div>
      <div class="relative">
        <RxButton
          :label="$t('上传')"
          icon="base/rx_ic_export"
          size="md"
          @click="handleInstall"
        />
      </div>
    </div>

    <div class="flex h-[calc(100%-38px)] flex-col gap-4 overflow-y-auto">
      <div
        v-for="skill in skills"
        :key="skill.name"
        class="flex items-start gap-3 rounded-1.5 bg-[var(--colors-background-bg-block)] px-4 py-10px"
      >
        <div class="flex flex-1 flex-col gap-1">
          <div class="flex items-center justify-between gap-3">
            <div class="font-['Inter'] text-[14px] leading-20px font-700 text-[var(--colors-text-text-primary)]">
              {{ skill.name }}
            </div>
            <button
              class="szie-6 flex cursor-pointer items-center justify-center rounded border-none bg-transparent outline-none"
              @click="handleUninstall(skill)"
            >
              <SvgIcon name="base/rx_ic_bin_1" size="16" />
            </button>
          </div>

          <div
            v-tooltip.top="{ value: skill.description, showDelay: 1000 }"
            class="line-clamp-3 font-['Inter'] text-[14px] leading-20px text-[var(--colors-text-text-primary)]"
          >
            {{ skill.description }}
          </div>
        </div>
      </div>

      <div v-if="loading" class="py-2 text-center text-sm text-gray-500">
        Loading...
      </div>
      <template v-else-if="skills.length === 0">
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
