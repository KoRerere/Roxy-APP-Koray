<script lang="ts" setup>
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import drawerContent from '/@/components/drawer-content.vue'
import RemarkIcon from '/@/components/remark-icon'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { setColumns } from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import columnsRow from './columns'

const props = defineProps({
  data: {
    type: Object as PropType<any>,
    default: undefined,
  },
})
const emit = defineEmits(['confirm'])

const [showToast] = useResponseToast()

const columns = setColumns(columnsRow.data, {
  filters: ['actions'],
})

function tableFilters() {
  return [
  ]
}

const tableRef = useTemplateRef('account')
const selection = ref(props.data?.windowPlatformList.filter((item: any) => item.id))

async function tableRequest(params: any) {
  return API.platform.userGetPlatformInfoV2List(params)
}

async function addRemark(platformRemarks: string, row: any) {
  const { code, msg } = await editAccount({ ...row, platformRemarks })
  showToast(code, msg)
  tableRef.value?.refresh()
}

function editAccount(formData: any) {
  return API.platform.userMdfPlatformInfoCreate(formData)
}

function handleSave() {
  emit('confirm', selection.value)
}
</script>

<template>
  <drawerContent :title="$t('平台账号列表')" v-bind="$attrs">
    <div class="h-full">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="account" v-model:selection="selection" :multiple-operation="false" selection-mode="multiple" :table-request="tableRequest" :table-filters="tableFilters" :columns="columns"
        :show-display="false" :context-menu="false" :show-actions="false">
        <!-- <template #header-extra>
          <InputBase type="text" left-icon="base/rx_ic_magnify" name="search" placeholder="search" />
        </template> -->
        <template #platform="{ data: row }">
          <div class="platform">
            <img class="platform-img" :src="row.platformIcon">
            <div class="flex justify-between platform-region">
              <span>{{ row.platformUrl }}</span>
            </div>
            <div class="flex items-center platform-email">
              <span>{{ row.platformUserName }}</span>
              <RxSvgIcon v-if="row.platformEfa" class="text-blue platform-img" name="base/rx_ic_2fa" :size="16" />
            </div>
          </div>
        </template>
        <template #related="{ data: row }">
          <relatedInfo :list="row.window_info" />
        </template>
        <template #actions="{ data: row }">
          <RemarkIcon :value="row.platformRemarks" :on-confirm="(params: any) => addRemark(params, row)" />
        </template>
      </RyTable>
    </div>
    <template #footer>
      <RxButton severity="info" size="sm" :label="$t('保存')" @click="handleSave" />
    </template>
  </drawerContent>
</template>

<style lang="scss" scoped>
.platform {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-email {
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
