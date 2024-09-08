<script lang="ts" setup>
import ryTable from '/@/components/ry-table'
import ryTag from '/@/components/ry-tag'
import actions from '/@/components/actions.vue'
import drawerContent from '/@/components/drawer-content.vue'
import inputBase from '/@/components/ry-form/input-base.vue'
import { API } from '/@/api'
import type { UserGetPlatformInfoV2ListParams } from '@roxy/backend-api'

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
  {
    key: 'Actions',
    title: '操作',
    slot: 'actions',
  },
]

const operation = [
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi mdi-wifi-off',
    quick: true,
  },
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi mdi-refresh',
    quick: true,
  },
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi mdi-file-document-plus-outline',
    quick: true,
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

async function tableRequest(params: UserGetPlatformInfoV2ListParams) {
  const { data } = await API.platform.userGetPlatformInfoV2List(params)
  return data.rows.map(({ window_info, ...item }) => {
    const list = window_info.split(',').filter(v => v)
    const windowinfo = list.length > 1 ? [list[0], `+${list.length - 1}`] : list
    return { ...item, window_info: windowinfo }
  })
}
</script>

<template>
  <drawerContent title="账号列表" v-bind="$attrs">
    <div class="h-full">
      <ry-table selection-mode="multiple" :table-request="tableRequest" :columns="columns" :show-config="false"
        :filters="filters">
        <template #header-extra>
          <input-base type="text" left-icon="mdi mdi-magnify" name="search" placeholder="search" />
        </template>
        <template #platform="{ data }">
          <div class="platform">
            <img class="platform-img" :src="data.platformIcon" alt="">
            <div class="platform-nation">
              {{ data.platformUrl }}
            </div>
            <div class="platform-time">
              {{ data.platformName }}
            </div>
          </div>
        </template>
        <template #related="{ data }">
          <div class="related">
            <ry-tag v-for="item in data.window_info" :key="item">
              <span class="mdi mdi-monitor mr-1" />
              <span>{{ item }}</span>
            </ry-tag>
          </div>
        </template>
        <template #actions>
          <actions :operation="operation" />
        </template>
      </ry-table>
    </div>
  </drawerContent>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-2xl, 16px);
}

.platform {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-lg, 8px);
  grid-row-gap: var(--spacing-xs, 4px);

  &-img {
    font-size: 16px;
    line-height: 1;
    grid-row-start: span 2;
  }

  &-nation {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-time {
    color: var(--Colors-Text-text-inactive, #a3a9ad);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.related {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
}
</style>
