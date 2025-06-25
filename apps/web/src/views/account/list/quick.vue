<script lang="ts" setup>
import PlatformIcon from '/@/views/account/list/platform-icon.vue'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { getRawColumns } from './columns'
import { RxAlert } from '/@/components/rx-alert'
import { AccountBindType } from '/@/enums/account'

interface Props {
  data?: Record<string, any>
  isBatch?: boolean
  createCount?: number
  accountType?: AccountBindType
}

const { data, isBatch = false, createCount = 1, accountType = AccountBindType.Order } = defineProps<Props>()
const emit = defineEmits(['confirm', 'close'])

const columns = getRawColumns({
  filters: ['actions'],
})

const selection = ref(data?.windowPlatformList.filter((item: any) => item.id))
const sumProxyCount = computed(() => selection.value?.length ?? 0)

async function tableRequest(params: any) {
  return API.platform.userGetPlatformInfoV2List(params)
}

function handleSave() {
  emit('confirm', selection.value)
  emit('close')
}
</script>

<template>
  <div class="flex flex-col h-full account-content">
    <RxAlert class="w-full mt-3" :visible="isBatch && accountType === AccountBindType.Order" :closable="false" :type="sumProxyCount > createCount ? 'warn' : 'info'"
      :title="$t('{count} 个窗口将会绑定账号。您创建的窗口数为：{max}。{message}', { count: sumProxyCount, max: createCount, message: sumProxyCount > createCount ? $t('当前选择绑定的账号数量已超过创建窗口数。') : '' })" />
    <div class="flex-ovh-1">
      <RyTable v-model:selection="selection" :multiple-operation="false" selection-mode="multiple" :table-request="tableRequest" :columns="columns" :show-table-header="false" :show-display="false"
        :context-menu="false" :show-actions="false">
        <template #platform="{ data: row }">
          <div class="flex gap-2 select-none account">
            <div>
              <platformIcon v-if="row.platformIcon" :platformIcon="row.platformIcon" :platformIconDark="row.platformIconDark" class="w-4 h-4" />
              <RxSvgIcon v-else name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary, #7C8387)" />
            </div>
            <div class="flex flex-col flex-1 gap-1">
              <div class="flex items-center account-title">
                {{ row.platformUrl }}
              </div>
              <div class="flex items-center gap-1.5 account-subtitle">
                <span>{{ row.platformUserName }}</span>
                <RxSvgIcon v-if="row.platformEfa" class="text-blue" name="base/rx_ic_2fa" :size="16" />
              </div>
            </div>
          </div>
        </template>
        <template #remark="{ data }">
          <RxSvgIcon v-tooltip.top="{ value: data.platformRemarks, showDelay: 500 }" :name="data.platformRemarks ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
            :class="{ 'color-[#12A3FC]': data.platformRemarks }" />
        </template>
      </RyTable>
    </div>
    <div class="w-full flex justify-end gap-3 button-group">
      <RxButton size="sm" :label="$t('保存')" @click.stop="handleSave" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-content {
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) 0;
  min-width: var(--width-xl, 768px);
}

.account {
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);

  &-title {
    color: var(--colors-text-text-primary, #fafafa);
    font-weight: 500;
  }

  &-subtitle {
    color: var(--colors-text-text-tertiary);
  }
}

.button-group {
  padding: var(--spacing-2xl, 16px) 0 var(--spacing-3xl, 20px);
}
</style>
