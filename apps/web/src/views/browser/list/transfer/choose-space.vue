<script setup lang="ts">
import type { UserGetTransferWorkspaceListListData } from '@roxy/backend-api';
import { API } from '/@/api'
import { $t } from '/@/locales';
import { SpaceType } from '/@/views/browser/list/transfer/type.ts'
import { useWorkspaceStore } from "/@/stores/workspace";

type Data = UserGetTransferWorkspaceListListData['data'][number]

const { ids: windowIds } = defineProps<{
  ids: number[]
}>()

const { currentWorkspace } = storeToRefs(useWorkspaceStore())

const selectedWorkspace = defineModel<Data>('modelValue')

const chooseRef = useTemplateRef('choose')

const openLoading = ref(false)
const search = ref()
const searchLoading = ref(false)
const historyList = ref()

const spaceList = ref()

async function getTransferHistory(event: MouseEvent) {
  if (historyList.value) {
    spaceList.value = historyList.value
    chooseRef.value?.show(event, event.target!)
    return
  }

  if (openLoading.value) return

  openLoading.value = true
  const { data } = await API.window.userGetTransferWorkspaceListList({
    windowIds: windowIds.join(',')
  })
  openLoading.value = false

  const { self, history } = data.reduce((acc, item) => {
    if (item.type === SpaceType.Self) {
      acc.self.push(item)
    } else if (item.type === SpaceType.History) {
      acc.history.push(item)
    }
    return acc
  }, { self: [], history: [] } as Record<string, Data[]>)

  spaceList.value = [
    {
      key: SpaceType.History,
      title: $t('转移历史'),
      items: history.slice(0, 3)
    },
    {
      key: SpaceType.Self,
      title: $t('我的空间'),
      items: self
    }
  ].filter(item => item.items.length)

  historyList.value = spaceList.value
  chooseRef.value?.show(event, event.target!)
}

function clearSearch() {
  search.value = ''
  spaceList.value = historyList.value
}

async function onSearch() {
  if (!search.value || searchLoading.value) return
  searchLoading.value = true
  const { data } = await API.window.userGetTransferWorkspaceListList({
    windowIds: windowIds.join(','),
    transferWorkspaceNo: search.value
  })
  searchLoading.value = false
  spaceList.value = [
    {
      key: SpaceType.Other,
      title: $t('搜索结果:'),
      items: data
    }
  ]
}

async function clearHistory(space: any) {
  const workspaceIds = space.items.map((item: any) => item.workspaceId)
  await API.window.userClearTransferWorkspaceCreate({ workspaceIds })
  spaceList.value = spaceList.value.filter((item: any) => item.key !== space.key)
}

function handleChoose(item: Data) {
  if (!item.isWindowCountEnough || item.workspaceNo === currentWorkspace.value!.workspaceNo) return
  selectedWorkspace.value = item
  search.value = ''
  chooseRef.value?.hide()
}

function getAvatarStyle(workspacePicture: string) {
  return workspacePicture ? {} : { backgroundColor: '#000', color: '#fff', fontSize: '14px' }
}
</script>

<template>
  <div class="flex items-center justify-between w-125 pa-2.5 pl-3 select-none cursor-pointer choose" @click="getTransferHistory">
    <span>{{ selectedWorkspace?.workspaceName || $t('选择空间') }}</span>
    <SvgIcon v-if="!openLoading" class="pointer-events-none" name="base/rx_ic_chevron_down" />
    <div v-else class="relative px-3">
      <RxLoading :size="16" v-model="openLoading" />
    </div>
    <RyPopover ref="choose">
      <div class="w-125 relative flex flex-col gap-3 pa-3">
        <RxInputText v-model="search" left-icon="base/rx_ic_magnify" :placeholder="$t('搜索空间 ID')" :disabled="searchLoading" @keyup.enter="onSearch" @left-icon-click="onSearch">
          <template #icon>
            <SvgIcon v-show="search && !searchLoading" class="cursor-pointer" name="base/rx_ic_delete" @click="clearSearch"></SvgIcon>
          </template>
        </RxInputText>
        <div class="relative flex flex-col gap-6 max-h-100 overflow-y-auto">
          <RxLoading :opacity="0.9" v-model="searchLoading" />
          <div v-for="space of spaceList" :key="space.title">
            <div class="flex justify-between items-center mb-2 title">
              <div>{{ space.title }}</div>
              <div v-if="space.key === SpaceType.History" class="flex items-center gap-1 cursor-pointer" @click="clearHistory(space)">
                <SvgIcon name="base/rx_ic_bin_1"></SvgIcon>
                <span>{{ $t('清除历史') }}</span>
              </div>
            </div>
            <div v-for="item of space.items" :key="item.id" class="flex items-center gap-3 pa-1.5 cursor-pointer workspace"
              :class="{ 'disabled': !item.isWindowCountEnough || item.workspaceNo === currentWorkspace!.workspaceNo }" @click="handleChoose(item)">
              <Avatar :label="item.workspacePicture || item.workspaceName?.slice(0, 2)" class="workspace-icon" :style="getAvatarStyle(item.workspacePicture)"
                :pt="{ label: item.workspacePicture ? 'text-[32px]' : 'text-[34px]' }" />
              <div>
                <div class="workspace-name">{{ item.workspaceName }}</div>
                <div class="mt-1 workspace-id">
                  <span v-if="item.workspaceNo === currentWorkspace!.workspaceNo">{{ $t('当前空间') }}</span>
                  <span v-else-if="!item.isWindowCountEnough">{{ $t('窗口额度不足') }}</span>
                  <span v-else>ID: {{ item.workspaceNo }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RyPopover>
  </div>
</template>

<style scoped lang="scss">
.workspace-icon {
  width: 48px;
  height: 48px;
  color: #fff;
  text-align: center;
  font-family: 'JetBrains Mono';
  font-size: 20px !important;
  font-style: normal;
  font-weight: 700;
  line-height: 20px;
  letter-spacing: -0.4px;
  text-transform: uppercase;
}

.choose {
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--Colors-border-border-base, #AFB7BB);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  color: var(--Colors-text-text-placeholder, #575D60);
  font-size: 14px;
  line-height: var(--Line-Height-text-lg, 20px);
}

.title {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.workspace {
  border-bottom: 1px dashed var(--Colors-border-border-inactive, #C7D1D6);

  &.disabled {
    cursor: not-allowed;
    user-select: none;

    .workspace-name,
    .workspace-id {
      color: var(--Colors-text-text-inactive, #7D8387);
    }

    .workspace-icon {
      opacity: 0.4;
    }
  }

  &:last-of-type {
    border-bottom: none;
  }

  &-name {
    color: var(--Colors-text-text-primary, #111213);
    font-size: 14px;
    font-weight: 600;
    line-height: normal;
  }

  &-id {
    color: var(--Colors-text-text-tertiary, #575D60);
    font-family: "JetBrains Mono";
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>