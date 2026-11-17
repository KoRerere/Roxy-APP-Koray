<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import Dialog from 'primevue/dialog'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import wallpaper from '/@/assets/images/cloud-phone/android-wallpaper.png'
import androidWordmark from '/@/assets/images/cloud-phone/android-wordmark.svg?url'

const props = defineProps<{
  system: string
  version: string
  device: { location: string, timezone: string, brand: string, model: string, phoneNumber: string, imei: string, mac: string }
}>()

const { t: $t } = useI18n()

const collapsed = defineModel<boolean>('collapsed', { default: false })
const showPreview = ref(false)
const details = computed(() => [
  { label: $t('位置'), value: props.device.location },
  { label: $t('时区'), value: props.device.timezone },
  { label: $t('手机号码'), value: props.device.phoneNumber || $t('自动生成') },
  { label: $t('版本'), value: props.version, system: true },
  { label: $t('品牌'), value: props.device.brand },
  { label: $t('型号'), value: props.device.model },
  { label: 'IMEI', value: props.device.imei || $t('自动生成') },
  { label: 'MAC', value: props.device.mac || $t('自动生成'), wifi: true },
])
</script>

<template>
  <aside class="my-4 flex max-h-[calc(100%_-_32px)] min-h-0 shrink-0 flex-col self-start" :class="collapsed ? 'w-12' : 'w-93.75'">
    <section class="flex min-h-0 flex-col gap-3 overflow-hidden rounded-3 border border-solid border-[var(--colors-border-border-subtle)] bg-[var(--colors-background-bg-overlay)] p-4 shadow-[0_3px_8px_0_#00000012,0_2px_5px_0_#00000012,0_1px_1px_0_#00000012]">
      <div class="flex shrink-0 items-center justify-between gap-2">
        <h2 v-if="!collapsed" class="m-0 text-3 font-semibold leading-4 text-[var(--colors-text-text-primary)]">
          {{ $t('我的设备') }}
        </h2>
        <RxButton v-tooltip.top="collapsed ? $t('展开') : $t('收起')" class="!h-4 !w-4 !min-w-0 !p-0" size="xxs" severity="secondary" text :icon="collapsed ? 'base/rx_ic_show_preview' : 'base/rx_ic_hide_preview'" :aria-label="collapsed ? $t('显示设备') : $t('隐藏')" @click="collapsed = !collapsed" />
      </div>
      <div v-if="!collapsed" class="relative h-45 shrink-0 overflow-hidden rounded-1.5 bg-[linear-gradient(180deg,#ebf7ff_0%,#f6f6fd_100%)] dark:bg-[linear-gradient(180deg,#132d40_0%,#232334_100%)]">
        <div class="absolute bottom-0 left-1/2 h-40 w-42.5 overflow-hidden border-3 border-b-0 border-solid border-black rounded-t-6 -translate-x-1/2">
          <img :src="wallpaper" alt="" class="h-full w-full object-cover">
          <span class="absolute bottom-2 left-1/2 flex items-center gap-0.75 whitespace-nowrap text-6 font-light tracking-tight text-white -translate-x-1/2"><img v-if="system === 'Android'" :src="androidWordmark" alt="Android" class="h-4.5 w-18.25"><span v-else>iOS</span>{{ version }}</span>
        </div>
      </div>
      <dl v-if="!collapsed" class="m-0 flex min-h-0 flex-col overflow-y-auto px-3 pb-6 font-[DM_Mono] text-3 font-medium leading-4 tracking-[-0.12px]">
        <div v-for="item in details" :key="item.label" class="flex min-h-6 shrink-0 items-start gap-1 py-1">
          <dt class="flex w-30 shrink-0 items-center gap-1 text-[var(--pattern-editor-key,#005cc5)]">
            <RxSvgIcon v-if="item.wifi" name="base/rx_ic_wifi" :size="14" />
            {{ item.label }}
          </dt>
          <dd class="m-0 flex min-w-0 flex-1 items-center gap-1 break-all text-[var(--pattern-editor-value,#032f62)]">
            <RxSvgIcon v-if="item.system" :name="system === 'Android' ? 'platforms/rx_os_android' : 'platforms/rx_os_iOS'" :size="14" />
            {{ item.value }}
          </dd>
        </div>
      </dl>
      <RxButton v-if="!collapsed" class="!w-full shrink-0" size="lg" severity="secondary" outlined icon="base/rx_ic_eye" :label="$t('预览')" @click="showPreview = true" />
    </section>
  </aside>
  <Dialog v-model:visible="showPreview" modal :header="$t('设备预览')" :style="{ width: '380px', maxWidth: 'calc(100vw - 32px)' }">
    <p class="mb-4 mt-0 text-3 text-[var(--colors-text-text-tertiary)]">
      {{ $t('设备信息为配置预览，实际信息以创建后的设备为准。') }}
    </p>
    <div class="relative mx-auto h-100 w-54 overflow-hidden border-4 border-solid border-black rounded-8">
      <img :src="wallpaper" alt="" class="h-full w-full object-cover">
      <span class="absolute bottom-10 left-1/2 whitespace-nowrap text-7 text-white -translate-x-1/2">{{ system }} {{ version }}</span>
    </div>
  </Dialog>
</template>
