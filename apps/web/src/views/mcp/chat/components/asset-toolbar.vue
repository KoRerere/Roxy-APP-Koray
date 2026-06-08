<script setup lang="tsx">
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import type { AssetGenerationOptions } from '/@/views/mcp/types'

const props = withDefaults(defineProps<Props>(), {
  attachmentCount: 0,
  disabled: false,
})

const emit = defineEmits<Emits>()

interface Props {
  canUploadMore: boolean
  attachmentCount?: number
  maxAttachments: number
  disabled?: boolean
}

interface Emits {
  (e: 'upload'): void
}

const assetOptions = defineModel<AssetGenerationOptions>('assetOptions', {
  required: true,
})

const { showMenu } = usePopupMenu()
const aspectRatioPopoverRef = ref()
const aspectRatioOpen = ref(false)
const qualityOpen = ref(false)
const countOpen = ref(false)
let removeMenuOpenListener: (() => void) | null = null

function trackMenuOpen(openRef: Ref<boolean>) {
  removeMenuOpenListener?.()
  openRef.value = true
  const handler = () => {
    openRef.value = false
    removeMenuOpenListener = null
  }
  document.addEventListener('click', handler, { once: true, capture: true })
  removeMenuOpenListener = () => {
    document.removeEventListener('click', handler, true)
    removeMenuOpenListener = null
  }
}

const aspectRatioOptions = [
  { label: '1:1', value: '1:1', w: 20, h: 20 },
  { label: '4:3', value: '4:3', w: 20, h: 15 },
  { label: '3:4', value: '3:4', w: 15, h: 20 },
  { label: '16:9', value: '16:9', w: 20, h: 11 },
  { label: '9:16', value: '9:16', w: 12, h: 20 },
  { label: '3:2', value: '3:2', w: 20, h: 13 },
  { label: '2:3', value: '2:3', w: 13, h: 20 },
  { label: '21:9', value: '21:9', w: 20, h: 9 },
]

const qualityOptions = [
  { label: '2K', value: '2K' },
  // { label: '3K', value: '3K' },
  { label: '4K', value: '4K' },
]

function removeTrailingS(str: string) {
  if (str && str.endsWith('s')) {
    return str.slice(0, -1)
  }
  return str
}

const countOptions = [
  { label: removeTrailingS($t('{count} 张', { count: 1 })), value: '1' },
  { label: $t('{count} 张', { count: 2 }), value: '2' },
  { label: $t('{count} 张', { count: 3 }), value: '3' },
  { label: $t('{count} 张', { count: 4 }), value: '4' },
]

function makeMenuOptions<T extends string>(
  options: { label: string, value: T }[],
  currentValue: T,
  onSelect: (value: T) => void,
) {
  return options.map(o => ({
    label: o.label,
    command: () => { onSelect(o.value) },
    render: () => (
      <div class={['flex items-center justify-between gap-3 w-full px-2.5 py-2 rounded-[var(--p-menu-item-border-radius)] cursor-pointer hover:bg-[var(--colors-background-bg-action-hover)]', o.value === currentValue && 'bg-[var(--colors-background-bg-action-hover)]']}>
        <span class="text-3.25 text-[var(--colors-text-text-primary)]">{o.label}</span>
        {o.value === currentValue && <SvgIcon name="base/rx_ic_check" size="14" color="var(--colors-icon-icon-brand)" />}
      </div>
    ),
  }))
}

function showAspectRatioMenu(event: MouseEvent) {
  aspectRatioPopoverRef.value?.toggle(event)
  aspectRatioOpen.value = !aspectRatioOpen.value
}

function hideAspectRatioMenu() {
  aspectRatioPopoverRef.value?.hide()
  aspectRatioOpen.value = false
}

function showQualityMenu(event: MouseEvent) {
  hideAspectRatioMenu()
  trackMenuOpen(qualityOpen)
  showMenu(event, {
    model: makeMenuOptions(qualityOptions, assetOptions.value.quality, v => assetOptions.value.quality = v),
    menuProps: { style: { minWidth: '80px', width: '80px' } },
  })
}

function showCountMenu(event: MouseEvent) {
  hideAspectRatioMenu()
  trackMenuOpen(countOpen)
  const opts = countOptions.map(o => ({ label: o.label, value: o.value }))
  showMenu(event, {
    model: makeMenuOptions(opts, assetOptions.value.count, v => assetOptions.value.count = v),
    menuProps: { style: { minWidth: '120px', width: '120px' } },
  })
}

function onClickUpload() {
  if (!props.canUploadMore)
    return
  emit('upload')
}

onBeforeUnmount(() => {
  removeMenuOpenListener?.()
})
</script>

<template>
  <div class="flex items-center gap-3 flex-wrap">
    <!-- 上传按钮 -->
    <button type="button" class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer" :class="{ 'opacity-40 cursor-not-allowed': !canUploadMore }" @click.stop="onClickUpload">
      <SvgIcon name="base/rx_ic_attachment" size="16" color="var(--colors-icon-icon-tertiary)" />
      <span>
        {{ $t('上传') }}
        <span v-if="attachmentCount > 0">({{ attachmentCount }}/{{ maxAttachments }})</span>
      </span>
    </button>

    <!-- 选项组 -->
    <div class="inline-flex items-center gap-1 h-[30px] rounded-[60px] bg-[var(--component-segment-bg-selection)]">
      <button v-tooltip.top="{ value: $t('比例'), showDelay: 300 }" type="button" class="flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[60px] bg-transparent text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer whitespace-nowrap overflow-hidden hover:bg-[var(--component-table-bg-button-hover)]" @click.stop="showAspectRatioMenu">
        <span>{{ assetOptions.aspectRatio }}</span>
        <SvgIcon name="base/rx_ic_chevron_down" size="16" color="var(--colors-icon-icon-primary)" :class="{ 'rotate-180': aspectRatioOpen }" class="transition-transform duration-200" />
      </button>
      <Popover ref="aspectRatioPopoverRef" unstyled>
        <div class="grid grid-cols-4 gap-2 p-2 bg-[var(--colors-background-bg-page)] border-[0.5px] border-[var(--colors-border-border-action)] rounded-lg shadow-[0_1px_1px_rgba(0,0,0,0.07),0_2px_2.5px_rgba(0,0,0,0.07),0_3px_4px_rgba(0,0,0,0.07)]">
          <button
            v-for="o in aspectRatioOptions"
            :key="o.value"
            type="button"
            class="flex flex-col items-center justify-center gap-1 w-[60px] h-[68px] px-3 border-0 rounded-md bg-[var(--colors-background-bg-action-hover)] text-sm leading-5 cursor-pointer"
            :class="assetOptions.aspectRatio === o.value ? 'text-[var(--colors-text-text-brand)]' : 'text-[var(--colors-text-text-primary)]'"
            @click.stop="assetOptions.aspectRatio = o.value; hideAspectRatioMenu()"
          >
            <div class="flex items-center justify-center w-5 h-5">
              <div
                class="rounded-[2px]"
                :style="{
                  width: `${o.w}px`,
                  height: `${o.h}px`,
                  background: assetOptions.aspectRatio === o.value ? 'var(--colors-icon-icon-brand)' : 'var(--colors-icon-icon-note)',
                }"
              />
            </div>
            <span>{{ o.label }}</span>
          </button>
        </div>
      </Popover>
      <button v-tooltip.top="{ value: $t('分辨率'), showDelay: 300 }" type="button" class="flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[60px] bg-transparent text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer whitespace-nowrap overflow-hidden hover:bg-[var(--component-table-bg-button-hover)]" @click.stop="showQualityMenu">
        <span>{{ assetOptions.quality }}</span>
        <SvgIcon name="base/rx_ic_chevron_down" size="16" color="var(--colors-icon-icon-primary)" :class="{ 'rotate-180': qualityOpen }" class="transition-transform duration-200" />
      </button>
      <button v-tooltip.top="{ value: $t('生成张数'), showDelay: 300 }" type="button" class="flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[60px] bg-transparent text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer whitespace-nowrap overflow-hidden hover:bg-[var(--component-table-bg-button-hover)]" @click.stop="showCountMenu">
        <span>{{ countOptions.find(o => o.value === assetOptions.count)?.label ?? assetOptions.count }}</span>
        <SvgIcon name="base/rx_ic_chevron_down" size="16" color="var(--colors-icon-icon-primary)" :class="{ 'rotate-180': countOpen }" class="transition-transform duration-200" />
      </button>
    </div>
  </div>
</template>
