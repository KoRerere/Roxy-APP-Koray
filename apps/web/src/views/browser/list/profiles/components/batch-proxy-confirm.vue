<script setup lang="ts">
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'

/** 一行改动：窗口 + 绑定后的 IP + 绑定前的 IP */
export interface ProxyChangeRow {
  profile: Record<string, any>
  after: Record<string, any>
}

const { rows, onCancel, onConfirm } = defineProps<{
  rows: ProxyChangeRow[]
  /** 继续编辑：只关弹窗，回到批量配置抽屉 */
  onCancel: () => void
  /** 确认并保存 */
  onConfirm: () => Promise<void>
}>()

const saving = ref(false)

async function confirm() {
  saving.value = true
  try {
    await onConfirm()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="w-[768px] max-w-[calc(100vw-48px)] flex flex-col gap-4 px-6 pt-4 pb-6 confirm-modal">
    <div class="flex items-center justify-between gap-3">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('确认 IP 地址变更') }}
      </div>
      <RxButton text severity="secondary" size="sm" icon="base/rx_ic_delete" @click="onCancel" />
    </div>

    <div class="flex flex-col">
      <div class="flex items-center gap-3 h-8 px-6 rounded-1 tt-primary text-3 font-600 leading-4 change-head">
        <span class="w-40 shrink-0">{{ $t('窗口名称') }}</span>
        <span class="flex-1 min-w-0">{{ $t('变更后 IP 地址') }}</span>
        <span class="w-4 shrink-0" />
        <span class="flex-1 min-w-0">{{ $t('变更前 IP 地址') }}</span>
      </div>
      <div class="max-h-[50vh] overflow-y-auto">
        <div v-for="row in rows" :key="row.profile.id" class="flex items-center gap-3 h-15 px-6 change-row">
          <span class="w-40 shrink-0 truncate tt-primary text-3 font-500 leading-4">{{ row.profile.windowName || '--' }}</span>
          <OutboundIp class="flex-1 min-w-0" :country="row.after.lastCountry" :city="row.after.lastCity" :last-ip="row.after.lastIp" :time="row.after.checkTime" />
          <SvgIcon class="shrink-0" name="base/rx_ic_play" size="16" color="var(--colors-icon-icon-brand, #11a3fd)" />
          <OutboundIp class="flex-1 min-w-0" :country="row.profile.lastCountry" :city="row.profile.lastCity" :last-ip="row.profile.lastIp" :time="row.profile.checkTime" />
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2.5 pt-6">
      <RxButton severity="secondary" outlined size="lg" :label="$t('继续编辑')" @click="onCancel" />
      <RxButton size="lg" class="min-w-37.5" :label="$t('确认并保存')" :loading="saving" @click="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.confirm-modal {
  background: var(--colors-background-bg-page);
  border-radius: 8px;
}

.change-head {
  background: var(--component-table-bg-header);
  border: 0.5px solid var(--colors-border-border-inactive);
}

.change-row {
  border-bottom: 1px solid var(--component-table-border-cell);
}
</style>
