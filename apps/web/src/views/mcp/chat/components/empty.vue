<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import AutoThemeImage from '/@/views/account/list/components/platform-icon.vue'

defineProps<{
  preset: any[]
}>()

const message = defineModel<string>('message')

function setMesage(item: any) {
  message.value = item.promptTemplateContent
}
</script>

<template>
  <div class="relative flex flex-col justify-end items-start px-7 pb-50 overflow-hidden">
    <AutoThemeImage class="absolute top-0 left-1/2 -translate-x-1/2 w-335" :platform-icon="getImage('mcp/agent-bg.png')" :platform-icon-dark="getImage('mcp/agent-bg-dark.png')" />
    <div class="relative flex flex-col gap-1.5 z-1">
      <div class="text-[var(--colors-text-text-primary)] text-2xl font-bold leading-8">
        {{ $t('Roxy AI Agent, 您的数字员工') }}
      </div>
      <div class="text-[var(--colors-text-text-placeholder)] text-[13px] leading-5">
        {{ $t('我可以帮您完成养号、创建窗口、配置代理IP等各类自动化操作。试试以下指令模板：') }}
      </div>
      <div class="flex items-center flex-wrap pt-1.5 gap-2 select-none cursor-pointer">
        <RxButton v-for="item in preset" :key="item.id" severity="secondary" variant="outlined" :label="item.promptTemplateTitle" @click="setMesage(item)">
          <template #icon>
            <AutoThemeImage class="h-4" :platform-icon="item.promptTemplateIconLight" :platform-icon-dark="item.promptTemplateIconDark" />
          </template>
        </RxButton>
      </div>
    </div>
  </div>
</template>
