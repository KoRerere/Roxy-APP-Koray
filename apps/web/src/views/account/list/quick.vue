<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import drawerContent from '/@/components/drawer-content.vue'
import remarkIcon from '/@/components/remark-icon'
import { RxSvgIcon } from '/@/components/rx-icon/'
import inputBase from '/@/components/ry-form/input-base.vue'
import ryTable from '/@/components/ry-table'
import relatedProfiles from '/@/views/agent/list/components/related-profiles.vue'

const emit = defineEmits(['confirm'])

const toast = useToast()

const columns = [
  {
    title: '平台',
    key: 'platform',
    slot: 'platform',
  },
  {
    title: '账号名称',
    key: 'platformUserName',
  },
  {
    title: '相关简介',
    key: 'related',
    slot: 'related',
  },
]

const filters = [
  {
    label: 'city',
    name: 'city',
    value: '',
    placeholder: '选择平台',
    options: [
      { label: '所有平台', value: 'all' },
      { label: 'mac', value: 'mac' },
      { label: 'win', value: 'win' },
    ],
  },
]

const tableRef = useTemplateRef('accountTable')

async function tableRequest(params: any) {
  return API.platform.userGetPlatformInfoV2List(params)
}

async function addRemark([platformRemarks, close]: [string, () => void], data: any) {
  const { msg } = await editAccount({ ...data, platformRemarks })
  toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
  tableRef.value?.refresh()
  close()
}

function editAccount(formData: any) {
  return API.platform.userMdfPlatformInfoCreate(formData)
}
// ============================
const selection = ref()

function handleSave() {
  emit('confirm', selection.value)
}
</script>

<template>
  <drawerContent title="账号列表" v-bind="$attrs">
    <div class="h-full">
      <ry-table ref="accountTable" v-model:selection="selection" :multiple-operation="false" selection-mode="multiple"
        :table-request="tableRequest" :columns="columns" :show-config="false" :filters="filters">
        <template #header-extra>
          <input-base type="text" left-icon="mdi mdi-magnify" name="search" placeholder="search" />
        </template>
        <template #platform="{ data }">
          <div class="platform">
            <img class="platform-img" :src="data.platformIcon">
            <div class="flex justify-between platform-region">
              <span>{{ data.platformUrl }}</span>
            </div>
            <div class="flex items-center platform-email">
              <span>{{ data.platformUserName }}</span>
              <RxSvgIcon v-if="data.platformEfa" class="text-blue platform-img" name="base/rx_ic_2fa" :size="16" />
            </div>
          </div>
        </template>
        <template #related="{ data }">
          <relatedProfiles :list="data.window_info" />
        </template>
        <template #actions="{ data }">
          <remarkIcon :value="data.platformRemarks" @on-confirm="(params: any) => addRemark(params, data)" />
        </template>
      </ry-table>
    </div>
    <template #footer>
      <ryButton severity="info" size="small" label="Save selected" @click="handleSave" />
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
