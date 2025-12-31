<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import TransferHelp from '/@/views/browser/list/transfer/help.vue'
import { API } from '/@/api'
;
import { debounce } from 'es-toolkit'
import { SpaceType } from '/@/views/browser/list/transfer/type.ts'
import { useWorkspaceStore } from "/@/stores/workspace";
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import type { UserGetTransferWorkspaceListListData } from '@roxy/backend-api';

type Data = UserGetTransferWorkspaceListListData['data'][number]

const { ids: windowIds, width = 'w-108' } = defineProps<{
  ids: number[]
  width?: string
}>()

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const [showModal] = RxUseDialog()

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
  }, { self: [] as Data[], history: [] as Data[] })

  spaceList.value = [
    {
      key: SpaceType.History,
      title: $t('投送历史'),
      items: history.slice(0, 3)
    },
    {
      key: SpaceType.Self,
      title: $t('我的工作空间'),
      items: self
    }
  ].filter(item => item.items.length)

  historyList.value = spaceList.value
  chooseRef.value?.show(event, event.target!)
}

async function howToGetHelp() {
  chooseRef.value?.hide()
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(TransferHelp, {
        onClose: () => {
          hideModal()
        },
        onConfirm: () => {
          hideModal()
        },
      })
    }
  })
}

function clearSearch() {
  search.value = ''
  spaceList.value = historyList.value
}

const onInput = debounce(onSearch, 300)

async function onSearch() {
  if (!search.value || search.value.length < 10 || searchLoading.value) return
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
  historyList.value = spaceList.value
}

function handleChoose(item: Data) {
  if (!item.isWindowCountEnough || item.workspaceNo === currentWorkspace.value!.workspaceNo) return
  selectedWorkspace.value = item
  search.value = ''
  chooseRef.value?.hide()
}

function getAvatarStyle(workspacePicture: string) {
  return workspacePicture ? {} : { backgroundColor: 'var(--pattern-topnav-space-avatar-bg)', color: '#fff', fontSize: '14px' }
}
</script>

<template>
  <div class="flex items-center justify-between w-full pa-2.5 pl-3 select-none cursor-pointer choose" :class="width" @click="getTransferHistory">
    <span :class="{ 'choose-text': !!selectedWorkspace?.workspaceName }">{{ selectedWorkspace?.workspaceName || $t('选择空间') }}</span>
    <SvgIcon v-if="!openLoading" class="pointer-events-none" name="base/rx_ic_chevron_down" />
    <div v-else class="relative px-3">
      <RxLoading :size="16" v-model="openLoading" />
    </div>
    <RyPopover ref="choose" @hide="clearSearch">
      <div class="relative flex flex-col gap-3 pa-3 overflow-hidden" :class="width">
        <div class="flex justify-between items-center">
          <div class="header">{{ $t('选择空间') }}</div>
          <i18n-t class="help" tag="div" :keypath="$t('如何获取{link}?', { link: '{link}' })" scope="global">
            <template #link>
              <span class="cursor-pointer help-link" @click="howToGetHelp">{{ $t('空间 ID') }}</span>
            </template>
          </i18n-t>
        </div>
        <TsFormInputText v-model="search" size="md" pre-icon="base/rx_ic_magnify" :placeholder="$t('搜索空间 ID')" :disabled="searchLoading" @keyup.enter="onSearch" @pre-icon-click="onSearch"
          @input="onInput">
          <template #icon>
            <SvgIcon v-show="search && !searchLoading" class="cursor-pointer" name="base/rx_ic_delete" @click="clearSearch"></SvgIcon>
          </template>
        </TsFormInputText>
        <div class="relative flex flex-col gap-6 -mr-3 pr-3 max-h-80 overflow-y-auto">
          <RxLoading :opacity="0.9" v-model="searchLoading" />
          <div v-for="space of spaceList" :key="space.title">
            <div class="flex justify-between items-center mb-2 title">
              <div class="text-[var(--colors-text-text-primary)]">{{ space.title }}</div>
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
          <div v-if="search && !spaceList[0]?.items?.length" class="flex flex-col items-center justify-center py-12 gap-1.5 search-empty">
            <div>{{ $t('空间不存在') }}</div>
            <i18n-t class="help" tag="div" :keypath="$t('如何获取{link}?', { link: '{link}' })" scope="global">
              <template #link>
                <span class="cursor-pointer help-link" @click="howToGetHelp">{{ $t('空间 ID') }}</span>
              </template>
            </i18n-t>
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
  border-radius: 8px;
  background: var(--colors-background-bg-action);
  border: 1px solid var(--colors-border-border-action);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  color: var(--colors-text-text-inactive);
  font-size: 14px;
  line-height: 20px;

  &-text {
    color: var(--colors-text-text-primary);
  }
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.help {
  color: var(--colors-text-text-inactive, #7D8387);
  font-size: 12px;
  line-height: 20px;

  &-link {
    color: var(--colors-text-text-brand, #11A3FD);
  }
}

.title {
  color: var(--component-button-primary-text, #111213);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.workspace {
  border-bottom: 1px dashed var(--colors-border-border-inactive, #C7D1D6);

  &.disabled {
    cursor: not-allowed;
    user-select: none;

    .workspace-name,
    .workspace-id {
      color: var(--colors-text-text-inactive, #7D8387);
    }

    .workspace-icon {
      opacity: 0.4;
    }
  }

  &:last-of-type {
    border-bottom: none;
  }

  &-name {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: normal;
  }

  &-id {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: "JetBrains Mono";
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.search-empty {
  color: var(--component-button-primary-text, #111213);
  font-size: 14px;
  font-style: normal;
  line-height: 20px;
}
</style>
