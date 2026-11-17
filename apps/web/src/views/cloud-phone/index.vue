<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppStore from './components/app-store.vue'
import OperationLogs from './components/operation-logs.vue'
import PhoneList from './components/phone-list.vue'
import PhoneTrash from './components/phone-trash.vue'
import PhoneWallEmpty from './components/phone-wall-empty.vue'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import type { SvgNames } from '/@/components/rx-icon'
import RxTabs from '/@/components/rx-tabs'

const { t: $t } = useI18n()

const activeTab = ref('all')
const router = useRouter()

function createPhone() {
  router.push({ name: 'cloud-phone-create' })
}

const tabs = computed(() => [
  { title: $t('全部云手机'), value: 'all' },
  { title: $t('应用商店'), value: 'app_store' },
  { title: 'App store2', value: 'app_store2' },
  { title: $t('操作日志'), value: 'logs' },
  { title: $t('空状态'), value: 'empty' },
  { title: $t('回收站'), value: 'trash', icon: 'base/rx_ic_bin_2' as const },
])
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex shrink-0 items-center justify-between gap-4 border-0 border-b-0.5 border-solid border-[var(--colors-border-divider)] pr-6">
      <RxTabs v-model:value="activeTab" :tabs="tabs" head-tabs only-tabs class="min-w-0 flex-1 overflow-hidden [&_.p-tab:not(.p-tab-active)]:!text-[var(--colors-text-text-secondary)] [&_.p-tab-active]:!font-bold [&_.p-tablist-tab-list]:!border-transparent">
        <template #tab="{ data }">
          <div class="flex items-center justify-center gap-1.5 font-[Inter]">
            <RxSvgIcon v-if="data.icon" :name="data.icon as SvgNames" color="var(--colors-icon-icon-note)" />
            <span :class="{ 'font-medium': data.icon && activeTab !== data.value }">{{ data.title }}</span>
          </div>
        </template>
      </RxTabs>
      <RxButton v-if="activeTab === 'trash'" size="xs" icon="base/rx_ic_plus" :label="$t('创建云手机')" class="shrink-0" @click="createPhone" />
    </div>

    <PhoneList v-if="activeTab === 'all'" class="flex-1 min-h-0" @create="createPhone" />
    <AppStore
      v-else-if="activeTab === 'app_store' || activeTab === 'app_store2'" :key="activeTab"
      :variant="activeTab === 'app_store2' ? 'compact' : 'default'" class="flex-1 min-h-0" @create="createPhone"
    />
    <OperationLogs v-else-if="activeTab === 'logs'" class="flex-1 min-h-0" />
    <PhoneWallEmpty v-else-if="activeTab === 'empty'" class="flex-1 min-h-0" @create="createPhone" />
    <PhoneTrash v-else class="flex-1 min-h-0" />
  </div>
</template>
