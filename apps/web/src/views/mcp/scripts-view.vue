<script setup lang="ts">
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import { API } from '/@/api'
import type { UserGetRpaScriptLibraryListListData } from '@roxy/backend-api'

type ScriptItem = UserGetRpaScriptLibraryListListData['data']['rows'][number]

interface ScriptCategory {
  name: string
  scripts: ScriptItem[]
}

const emit = defineEmits<{
  (e: 'useScript', script: ScriptItem): void
}>()

const categories = ref<ScriptCategory[]>([])
const loading = ref(false)

async function loadScripts() {
  loading.value = true
  try {
    const result = await API.base.userGetRpaScriptLibraryListList()
    if (result.code === 0) {
      const rows = result.data?.rows ?? []
      const groupMap = new Map<string, ScriptItem[]>()
      for (const item of rows) {
        const key = item.category || 'Other'
        if (!groupMap.has(key)) {
          groupMap.set(key, [])
        }
        groupMap.get(key)!.push(item)
      }
      categories.value = Array.from(groupMap.entries()).map(([name, scripts]) => ({
        name,
        scripts,
      }))
    }
  }
  finally {
    loading.value = false
  }
}

function handleUseScript(script: ScriptItem) {
  emit('useScript', script)
}

onMounted(() => {
  loadScripts()
})
</script>

<template>
  <div class="h-full flex flex-col rounded-4 bg-[var(--colors-background-bg-page)] pt-15">
    <!-- 顶部标题栏 -->
    <div class="w-full h-15 flex items-center px-6 border border-b-solid border-[var(--colors-border-border-inactive)] absolute top-0 left-0">
      <div class="font-['Inter'] font-semibold text-[var(--colors-text-text-primary)] text-lg">
        Scripts
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto flex flex-col gap-8 p-6">
      <!-- 分类区块 -->
      <div v-for="category in categories" :key="category.name" class="flex flex-col gap-4">
        <!-- 分类标题 -->
        <div class="font-['Inter'] font-500 text-[14px] text-[var(--colors-text-text-primary)] leading-20px">
          {{ category.name }}
        </div>

        <!-- 脚本卡片网格 -->
        <div class="grid grid-cols-2 gap-4">
          <div
            v-for="script in category.scripts"
            :key="script.id"
            class="bg-[var(--colors-background-bg-block)] rounded-1.5 p-3 flex gap-3"
          >
            <!-- 图标 -->
            <div class="size-12 rounded-1.5 bg-[var(--colors-background-bg-page)] flex items-center justify-center shrink-0 overflow-hidden">
              <img
                v-if="script.iconUrl"
                :src="script.iconUrl"
                class="size-8 object-contain"
              >
              <SvgIcon v-else name="base/rx_ic_script" size="32" color="var(--colors-icon-icon-tertiary)" />
            </div>

            <!-- 内容 -->
            <div class="flex-1 flex flex-col min-w-0">
              <!-- 标题 + 描述 -->
              <div class="flex flex-col gap-1">
                <div class="font-['Inter'] font-700 text-[14px] text-[var(--colors-text-text-primary)] leading-20px truncate">
                  {{ script.title }}
                </div>
                <div class="font-['Inter'] text-[12px] text-[var(--colors-text-text-secondary)] leading-[18px] line-clamp-3">
                  {{ script.description }}
                </div>
              </div>

              <!-- 底部操作 -->
              <div class="flex items-center justify-between mt-auto pt-2">
                <div class="font-['Inter'] text-[12px] text-[var(--colors-text-text-inactive)] leading-20px">
                  Created by: Roxy
                </div>
                <div
                  class="flex items-center gap-1 cursor-pointer group"
                  @click="handleUseScript(script)"
                >
                  <span class="font-['Inter'] text-[12px] text-[var(--colors-text-text-brand)] leading-20px group-hover:underline">
                    Use Script
                  </span>
                  <SvgIcon name="base/rx_ic_arrow_right_2" size="16" color="var(--colors-text-text-brand)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center text-sm text-gray-500 py-2">
        Loading...
      </div>
    </div>
  </div>
</template>
