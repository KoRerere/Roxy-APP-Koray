<script setup lang="ts">
import Header from './header.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'

const workspaceStore = useWorkspaceStore()
const syncControlTableRef = useTemplateRef('syncControlTable')
const tableData = ref<any[]>([])
const columns = ref([
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile'
  },
  {
    title: $t('状态'),
    key: 'status',
    slot: 'status'
  },
  {
    title: $t('操作'),
    key: 'actions',
    slot: 'actions',
  },
])

const selectedRows = computed(() => {
  return syncControlTableRef.value?.selectionData || []
})

async function tableFilters() {
  const { data } = await API.team.userGetMemberInfoByWorkspaceList({})
  return [
    {
      type: 'multiple',
      name: 'userNameIds',
      value: [],
      placeholder: $t('全部成员'),
      options: data.rows.map(user => ({ label: user.email, value: user.user_id })),
    },
    {
      type: 'multiple',
      name: 'operateModule',
      value: [],
      placeholder: $t('全部操作'),
      options: [
        { label: $t('窗口'), value: 'Profiles' },
        { label: $t('代理'), value: 'Proxies' },
        { label: $t('账号'), value: 'Accounts' },
        { label: $t('项目'), value: 'Projects' },
        { label: $t('扩展'), value: 'Extensions' },
        // { label: $t('成员'), value: 'Members' },
        { label: $t('团队'), value: 'Teams' },
      ],
    },
    {
      type: 'date',
      name: 'date',
      placeholder: $t('全部时间'),
      formatValue: (input: any, _: any, formData: any) => {
        const [startDate, endDate] = (input.value || []).map((date: Date) => format(date, 'yyyy-MM-dd'))
        Object.assign(formData, { startDate, endDate })
      },
    },
  ]
}

const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase())

window.electronAPI.on('browser:launch-process-message', (event) => {
  getOpenedBrowser()
})

window.electronAPI.on('browser:on-close', (dirId) => {
  getOpenedBrowser()
})

async function getOpenedBrowser() {
  tableData.value = await window.electronAPI.send('browser:getOpenedBrowser')
  console.log('tableData.value', tableData.value)
}

onMounted(() => {
  getOpenedBrowser()
})

function startSync() {
  console.log('startSync', syncControlTableRef.value?.selectionData)
  window.electronAPI.send('syncControl:start', syncControlTableRef.value?.selectionData?.map(n => n.dirId))
}
</script>

<template>
  <div class="synchronizer">
    <Header />
    <RyTable ref="syncControlTable" :multipleOperation="false" :data-list="tableData" :columns="columns"
      selection-mode="multiple" :paginator="false" :show-actions="false" :show-display="false" :context-menu="false">
      <template #table-empty>
        <CustomEmpty icon="rx_illustration_filter.svg" :title="$t('暂无匹配结果')" :desc="$t('在当前条件下没有匹配结果。请使用其他过滤器再试一次。')" />
      </template>
      <template #profile="{ data }">
        <ProfileInfo :workspace-name="workspaceName" :data="data" :filter-keys="['os']" readonly />
      </template>
      <template #status="{ data }">
        --
      </template>
      <template #actions="{ data }">
        <div class="flex gap-2 cursor-pointer">
          <RxSvgIcon name="base/rx_ic_browser" />
          <RxSvgIcon name="base/rx_ic_cursor" />
        </div>
      </template>
    </RyTable>
    <RxButton :disabled="!selectedRows.length" :label="selectedRows.length
      ? $t('开始同步 {count} 个窗口', { count: selectedRows.length })
      : $t('开始同步')" class="start-sync-btn" @click="startSync" />
  </div>
</template>

<style>
html,
body {
  background: transparent;
  --p-disabled-opacity: 1;
}
</style>

<style lang="scss" scoped>
.synchronizer {
  width: 100vw;
  height: 100vh;
  display: flex;
  padding: var(--spacing-lg, 8px) var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) var(--spacing-2xl, 16px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--Color-neutrals-950, #0e1214);
  box-shadow:
    0px 3px 17px 0px rgba(0, 0, 0, 0.04),
    0px 4px 30px 0px rgba(0, 0, 0, 0.12),
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07);

  .start-sync-btn {
    width: 100%;
  }
}
</style>
