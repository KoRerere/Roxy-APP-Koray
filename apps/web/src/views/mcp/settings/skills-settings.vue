<script setup lang="tsx">
import { useAgentApi } from '../agent-api'
import type { SkillEntry } from '../agent-api'
import RxButton from '/@/components/rx-button/index.vue'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import Empty from './components/empty.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { I18nT } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const { listSkills, validateSkill, installSkill, uninstallSkill } = useAgentApi()
const [, onlyErrorToast] = useResponseToast()

const skills = ref<SkillEntry[]>([])
const loading = ref(false)

async function loadSkills() {
  loading.value = true
  try {
    const res = await listSkills()
    if (res.code === 0) {
      skills.value = res.data || []
    }
  }
  catch (e) {
    console.error('Failed to load skills:', e)
  }
  finally {
    loading.value = false
  }
}

async function handleInstall() {
  const sourcePath = await globalThis.electronAPI.send('dialog:selectFileOrDir', {
    filters: [
      { name: 'ZIP Files', extensions: ['zip'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (sourcePath) {
    await validateAndInstall(sourcePath)
  }
}

async function validateAndInstall(sourcePath: string) {
  // 先校验
  const validateRes = await validateSkill(sourcePath)
  if (validateRes.code !== 0) {
    toast.add({
      severity: 'warn',
      summary: $t('校验失败'),
      detail: (
        <I18nT keypath={$t('关于 Skills 的信息与配置方法，请访问 {skills}', { skills: '{skills}' })}>
          {{ skills: () => (
            <a href="https://agentskills.io/home" target="_barnk" class="text-[var(--colors-text-text-brand)] underline">
              {$t('Skills 介绍')}
            </a>
          ) }}
        </I18nT>
      ),
      life: 5000,
    })
    return
  }

  // 检测到脚本文件，给出非阻断性警告
  if (validateRes.data?.hasScripts) {
    toast.add({
      severity: 'warn',
      summary: $t('检测到脚本'),
      detail: $t('Roxy AI Agent 暂无法使用系统工具，含脚本的 Skills 可能运行受限。'),
      life: 6000,
    })
  }

  await installSkill(sourcePath)
  await loadSkills()
}

async function handleUninstall(skill: SkillEntry) {
  try {
    await uninstallSkill(skill.name)
    await loadSkills()
  }
  catch (e) {
    onlyErrorToast(-1, $t('卸载失败'))
    return Promise.reject(e)
  }
}

onMounted(() => {
  loadSkills()
})
</script>

<template>
  <div class="h-full" style="will-change: transform;">
    <!-- 标题和添加按钮 -->
    <div class="flex items-center justify-between mb-5">
      <div class="font-['Archivo'] font-semibold text-[var(--colors-text-text-primary)] text-6">
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

    <!-- Skills 列表 -->
    <div class="flex flex-col gap-4 overflow-y-auto h-[calc(100%-38px)]">
      <div
        v-for="skill in skills"
        :key="skill.name"
        class="bg-[var(--colors-background-bg-block)] rounded-1.5 px-4 py-10px flex items-center gap-3"
      >
        <!-- Skill Info -->
        <div class="flex-1 flex flex-col gap-1">
          <div class="flex items-center justify-between gap-3">
            <div class="font-['Inter'] font-700 text-[14px] text-[var(--colors-text-text-primary)] leading-20px">
              {{ skill.name }}
            </div>
            <!-- Actions -->
            <button
              class="szie-6 flex items-center justify-center rounded bg-transparent outline-none border-none cursor-pointer"
              @click="handleUninstall(skill)"
            >
              <SvgIcon name="base/rx_ic_bin_1" size="16" />
            </button>
          </div>

          <div class="font-['Inter'] text-[14px] text-[var(--colors-text-text-primary)] leading-20px">
            {{ skill.description }}
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center text-sm text-gray-500 py-2">
        Loading...
      </div>
      <template v-else-if="skills.length === 0">
        <Empty icon="base/rx_ic_fix" :title="$t('暂无 Skills')">
          <I18nT :keypath="$t('关于 Skills 的信息与配置方法，请访问 {skills}', { skills: '{skills}' })">
            <template #skills>
              <a href="https://agentskills.io/home" target="_barnk" class="text-[var(--colors-text-text-brand)] underline">
                {{ $t('Skills 介绍') }}
              </a>
            </template>
          </I18nT>
        </Empty>
        <div class="text-3 text-[var(--colors-text-text-inactive)] leading-[1.4]">
          * {{ $t('出于安全考虑，Roxy AI Agent 暂未开放系统权限工具，建议优先使用网页自动化与内容获取类 Skills。') }}
        </div>
      </template>
    </div>
  </div>
</template>
