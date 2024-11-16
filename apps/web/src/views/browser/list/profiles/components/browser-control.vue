<script setup lang="ts">
import { API } from '/@/api'
import circleProgress from '/@/components/circle-progress.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  openMessage: {
    type: Object,
    default: () => ({}),
  },
})

const emits = defineEmits(['open'])

const userStore = useUserStore()

const usePeoples = computed(() => props.data.statusInfo
  .filter((item: any) => item.openUserId !== userStore.userInfo.id)
  .map((item: any) => item.openUserName)
  .join(', '),
)

const browser = computed(() => {
  const message = props.openMessage[props.data.dirId]

  if (!message) {
    return {
      msg: $t('打开'),
      classes: 'cursor-pointer',
    }
  }

  const { pending, code, data, error } = message
  const complted = data?.percent === 100
  const opening = !(error || complted)

  return {
    code,
    pending,
    msg: error ? $t('打开') : data?.message,
    percent: data?.percent || 0,
    error: error?.message,
    opening,
    complted,
    classes: opening ? 'cursor-not-allowed' : 'cursor-pointer',
  }
})

async function openBrowser() {
  if (browser.value.pending || browser.value.opening) {
    return
  }
  // const { data: { rows: [data] } } = await API.window.userGetWindowInfoV2List({ windowIds: props.data.id as string, isDelete: 0, page_index: 1, page_size: 1 })
  emits('open', props.data)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div v-ripple class="flex-cc open-browser" :class="browser.classes" @click.stop="openBrowser">
      <circle-progress v-if="browser.percent && !browser.complted" size="16" stroke-width="5" :value="browser.percent" />
      <RxSvgIcon v-if="!browser.percent && !browser.pending" color="#12A3FC" name="base/rx_ic_chrome" />
      <span class="select-none">{{ browser.complted ? $t('查看') : browser?.msg }}</span>
    </div>
    <RxSvgIcon v-if="browser?.error" v-tooltip.top="browser.error" name="base/rx_ic_info_fill" class="text-red" />
    <RxSvgIcon v-if="usePeoples" v-tooltip.top="usePeoples" name="base/rx_ic_user_group" class="text-orange" />
  </div>
</template>

<style lang="scss" scoped>
.open-browser {
  padding: var(--spacing-sm, 4px) 10px;
  gap: var(--spacing-sm, 4px);

  border-radius: 4px;
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  color: var(--Color-neutrals-950, #0e1214);
  text-align: center;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
