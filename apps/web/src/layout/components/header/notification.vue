<script lang="tsx" setup>
import TransferReceive from '/@/views/browser/list/transfer/receive.vue'
import RedeemCodeRecord from '/@/views/campaign/spring-festival/record.vue'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { NotifyModule, NotifyStatus } from '/@/enums'
import { RoxyGiftsType } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import type { UserGetNotifyListData } from '@roxy/backend-api'

const InviteIntoWorkspace = defineAsyncComponent(() => import('/@/components/business/global-component/invite-into-workspace.vue'))

type Message = UserGetNotifyListData['data'][0] & { isInWorkspace?: boolean }

interface Tab {
  value: string
  title: string
  list: Message[]
  noRead: number
}

const router = useRouter()
const [showModal] = RxUseDialog()
const { setCurrentWorkspace } = useWorkspaceStore()

const ROXY_GIFTS_TYPE = ref(new Set(Object.values(RoxyGiftsType)))

const pop = ref()
const tabs = ref<Tab[]>([
  {
    value: 'sys',
    title: $t('系统通知'),
    list: [],
    noRead: 0,
  },
  {
    value: 'teams',
    title: $t('团队通知'),
    list: [],
    noRead: 0,
  },
])
const tabsValue = ref('sys')

const noRead = computed(() => tabs.value.reduce((acc, tab) => acc + tab.noRead, 0))
const readSet = ref<Set<number>>(new Set())

onBeforeMount(() => {
  getMessageList()
    .finally(() => {
      emitter.on('notifyUpdateData', getMessageList)
    })
})

function toggle(event: Event) {
  getMessageList()
  const popIns = pop.value?.instance
  popIns.toggle(event)
  if (popIns.visible) {
    tabs.value.some((tab) => {
      if (tab.noRead) {
        tabsValue.value = tab.value
        return true
      }
      return tab.noRead
    })
  }
}

async function getMessageList(result?: UserGetNotifyListData) {
  const { code, data } = result || await API.base.userGetNotifyList()

  if (code !== 0) {
    console.log('getMessageList', code, data)
    return
  }

  const [sysTab, teamsTab] = tabs.value

  const { teams, sys, teamsRead, sysRead } = (data ?? []).reduce((acc, item) => {
    if (item.messageModule === NotifyModule.teams) {
      acc.teams.push(item)
      acc.teamsRead += item.status!
    }
    else {
      acc.sys.push(item)
      acc.sysRead += item.status!
    }
    return acc
  }, { teams: [] as any, sys: [] as any, teamsRead: 0, sysRead: 0 })

  teamsTab!.noRead = teams.length - teamsRead
  sysTab!.noRead = sys.length - sysRead
  teamsTab!.list = teams
  sysTab!.list = sys
}

async function onRead(item: Message | Message[]) {
  if (!Array.isArray(item) && (item.status === NotifyStatus.read || readSet.value.has(item.id!)))
    return

  const items = ([] as Message[]).concat(item)
  const ids = items.map(item => item.id!)

  readSet.value = new Set([...readSet.value, ...ids])// 标记已读 id

  const { code } = await API.base.userReadNotifyCreate({ ids })
  if (code !== 0) {
    ids.forEach(id => readSet.value.delete(id))
    return
  }
  tabs.value.find(tab => tab.value === items[0]!.messageModule)!.noRead -= ids.length
  items.forEach(item => {
    Reflect.set(item, 'status', NotifyStatus.read)
  })
}

async function markAllAsRead() {
  const list = tabs.value.find(tab => tab.value === tabsValue.value)!.list.filter(item => item.status === NotifyStatus.unread && !readSet.value.has(item.id!))
  if (list?.length) {
    await onRead(list)
  }
}

function checkDetail(item: Message) {
  switch (item.type) {
    case '邀请用户通知':
      showAcceptInvitationDialog(item)
      break
    case '代理奖励通知':
      router.replace({ name: 'tutorial' })
      break
    case RoxyGiftsType.ISP:
      router.replace({ name: 'agent-list', query: { name: 'shop' } })
      break
    case RoxyGiftsType.Rotating:
      router.replace({ name: 'agent-list', query: { name: 'list' } })
      break
    case RoxyGiftsType.Profile:
      showRedeemCodeRecord()
      break
    case RoxyGiftsType.Staff:
      router.replace({ name: 'wallet' })
      break
  }
}

function checkTransfer(item: Message) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ hideModal }) => h(TransferReceive, {
        windowTransferNo: item.windowTransferNo!,
        onClose: hideModal,
      }),
    },
  })
}

function showAcceptInvitationDialog(item: Message) {
  showModal({
    showHeader: false,
    modal: true,
    class: '!w-[380px] pa-6',
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => {
        return <InviteIntoWorkspace inviteInfo={item.paramData!} onClose={async (intoWorkspaceId?: number) => {
          if (intoWorkspaceId) {
            setCurrentWorkspace(intoWorkspaceId)
            router.push({ name: 'browser' })
          }
          hideModal()
          onRead(item)
        }} />
      },
    },
  })
}

function showRedeemCodeRecord() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <RedeemCodeRecord onClose={hideModal}></RedeemCodeRecord>,
    },
  })
}
</script>

<template>
  <div class="flex justify-center">
    <OverlayBadge :value="noRead" severity="danger" size="small" :class="noRead ? '' : message['no-message']">
      <RxButton severity="secondary" icon="base/rx_ic_mail" outlined size="xs" @click="toggle" />
    </OverlayBadge>
    <RyPopover ref="pop">
      <div :class="message.wrapper">
        <div :class="message.header">
          <div :class="message.title">
            {{ $t('通知') }}
          </div>
          <RxButton severity="secondary" :class="message.read" size="sm" text icon="base/rx_ic_done" :label="$t('全部已读')" @click="markAllAsRead" />
        </div>
        <Tabs v-model:value="tabsValue">
          <TabList :pt="{ tablist: 'px-4 gap-4 h-[40px] !border-[var(--colors-border-border-subtle)]', activeBar: '!h-[2px]' }">
            <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value" class="flex flex-1 justify-center items-center gap-1.5">
              <span>{{ tab.title }}</span>
              <Badge v-if="tab.noRead" :value="tab.noRead" severity="danger" size="small" />
            </Tab>
          </TabList>
          <TabPanels class="!pa-0 min-h-[100px] max-h-[280px] overflow-auto">
            <TabPanel v-for="tab in tabs" :key="tab.title" :value="tab.value">
              <template v-if="tab.list?.length">
                <div v-for="item in tab.list" :key="item.id" class="flex" :class="[message.item, !item.status && message.noRead]" @click="onRead(item)">
                  <div :class="[message.avatar, !item.status && message.badge]">
                    <RxAvatar class="cursor-pointer mr-2" :avatar="item.avatar || (item.messageModule === 'sys' && item.sysType === 1 ? '/images/system-notice-avatar.png' : '')"
                      :name="item.userName?.slice(0, 2)" :color="item.avatarColor" :size="32" :font-size="18" />
                  </div>
                  <div class="w-full">
                    <div :class="message.value">
                      {{ item.notify }}
                    </div>
                    <div :class="message.time" class="w-full flex justify-between">
                      <span>{{ item.createTime }}</span>
                      <span v-if="item.paramData || ROXY_GIFTS_TYPE.has(item.type as RoxyGiftsType)" class="select-none" :class="message['check-detail']" @click="checkDetail(item)">{{
                        $t('查看详情') }}</span>
                      <span v-if="item.windowTransferNo" :class="message['check-detail']" @click="checkTransfer(item)">{{ $t('查看详情') }}</span>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex justify-center items-center min-h-[150px] max-h-[280px] text-4">
                  {{ $t('暂无消息') }}
                </div>
              </template>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </RyPopover>
  </div>
</template>

<style lang="scss" module="message">
.wrapper {
  width: 380px;
}

.header {
  display: flex;
  padding: var(--spacing-md, 3px) 16px;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  line-height: 24px;
}

.title {
  color: var(--colors-text-text-primary, #fafafa);
  font-weight: 600;
}

.read {
  color: var(--colors-text-text-primary, #171c1f);
  font-size: var(--Font-Size-text-sm, 12px);
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.item {
  display: flex;
  padding: var(--spacing-xl, 12px) var(--spacing-2xl, 16px);
  align-items: flex-start;
  gap: 10px;
  border-bottom: 1px solid var(--component-dropdown-divider, #6a757c);
  background: var(--colors-background-bg-overlay, #293038);

  &:last-of-type {
    border-bottom: none;
  }
}

.noRead {
  background: var(--component-table-bg-selected, #002742);
  border-color: var(--component-table-border-selected);
}

.no-message {
  :global(.p-badge) {
    display: none;
  }
}

.avatar {
  position: relative;
  aspect-ratio: 1;

  &.badge {
    &::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 8px;
      height: 8px;
      background-color: var(--component-rainbow-Red, #f53838);
      border-radius: 50%;
    }
  }
}

.value {
  color: var(--colors-text-text-primary, #b2b6b8);
  font-size: 14px;
  line-height: var(--Line-Height-text-md, 20px);
}

.check-detail {
  color: var(--colors-text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */
  cursor: pointer;
}

.check-detail.disabled {
  color: var(--colors-text-text-inactive, #a3a9ad);
  cursor: not-allowed;
}

.time {
  margin-top: 4px;
  color: var(--colors-text-text-secondary, #a3a9ad);
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
