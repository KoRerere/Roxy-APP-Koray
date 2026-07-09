<script lang="tsx" setup>
import { h } from 'vue'
import TransferReceive from '/@/views/browser/list/transfer/receive.vue'
import RedeemCodeRecord from '/@/layout/components/header/profile/components/record.vue'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { executeSomethingByTargetWorkspace } from '/@/hooks/useResponseToast/handleBusinessCode'
import { NotifyModule, NotifyStatus } from '/@/enums'
import { RoxyGiftsType } from '/@/enums/pay'
import { useEmitterEvent } from '/@/utils/eventBus'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import type { UserGetNotifyListData } from '@roxy/backend-api'

const InviteIntoWorkspace = defineAsyncComponent(() => import('/@/components/business/global-component/invite-into-workspace.vue'))

type Message = UserGetNotifyListData['data'][0] & { isInWorkspace?: boolean, _icon?: string }

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
const SYS_ICON_MAP = {
  success: 'status/success',
  warning: 'status/warning',
  gift: 'status/gift',
  transfer: 'status/transfer',
  speaker: 'status/speaker',
} as const

const popRef = useTemplateRef<any>('pop')
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

useEmitterEvent('notifyUpdateData', getMessageList)

onBeforeMount(() => {
  getMessageList()
})

function toggle(event: Event) {
  getMessageList()
  const popIns = popRef.value.instance
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
      acc.sys.push({
        ...item,
        _icon: SYS_ICON_MAP[item.notifyCategory as keyof typeof SYS_ICON_MAP],
      })
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
  items.forEach((item) => {
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
  if (item.windowTransferNo) {
    checkTransfer(item)
    return
  }

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
        workspaceId: item.workspaceId!,
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
        return (
          <InviteIntoWorkspace
            inviteInfo={item.paramData!}
            onClose={async (intoWorkspaceId?: number) => {
              if (intoWorkspaceId) {
                setCurrentWorkspace(intoWorkspaceId)
                router.push({ name: 'browser' })
              }
              hideModal()
              onRead(item)
            }}
          />
        )
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

function onHtmlClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('a')

  if (!link || link.target === '_blank')
    return

  const href = link.getAttribute('href')

  // 只拦截站内路由
  if (!href || href.startsWith('http'))
    return
  e.preventDefault()

  const url = new URL(href.slice(href.startsWith('#') ? 1 : 0), location.origin)

  const targetWorkspaceId = Number(url.searchParams.get('workspaceId'))
  if (targetWorkspaceId) {
    executeSomethingByTargetWorkspace(() => {
      jumpByUrl(url)
    })(targetWorkspaceId)
    return
  }

  jumpByUrl(url)
}

function jumpByUrl(url: URL) {
  router.replace({
    path: url.pathname,
    query: {
      ...Object.fromEntries(url.searchParams),
      _t: Date.now(),
    },
  })
}
</script>

<template>
  <div v-tooltip.left="{ value: $t('通知'), showDelay: 600 }" class="flex justify-center">
    <OverlayBadge :value="noRead" severity="danger" size="small" :class="noRead ? '' : message.empty">
      <RxButton severity="secondary" icon="base/rx_ic_mail" outlined size="xs" @click="toggle" />
    </OverlayBadge>
    <RyPopover ref="pop">
      <div class="w-95">
        <div class="flex py-1 px-4 justify-between items-center gap-3.5">
          <div :class="message.title">
            {{ $t('通知') }}
          </div>
          <RxButton severity="secondary" size="sm" text icon="base/rx_ic_done" :label="$t('全部已读')" @click="markAllAsRead" />
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
                <div v-for="item in tab.list" :key="item.id" class="flex gap-2.5 py-3 px-4 items-start" :class="[message.item, !item.status && message.noRead]" @click="onRead(item)">
                  <SvgIcon v-if="item._icon" class="w-5 h-5" :name="(item._icon as any)" />
                  <RxAvatar v-else class="relative cursor-pointer aspect-square" :class="{ [message.badge]: !item.status }"
                            :avatar="item.avatar || (item.messageModule === 'sys' && item.sysType === 1 ? '/images/system-notice-avatar.png' : '')" :name="item.userName?.slice(0, 2)" :color="item.avatarColor"
                            :size="24" :font-size="12"
                  />
                  <div class="flex-1 flex flex-col gap-1.5">
                    <div :class="[tab.value, message.text]" @click="onHtmlClick" v-html="item.notify" />
                    <div class="flex justify-between items-center">
                      <div :class="message.time">
                        {{ item.createTime }}
                      </div>

                      <div v-if="item.paramData || ROXY_GIFTS_TYPE.has(item.type as RoxyGiftsType) || item.windowTransferNo" class="flex items-center gap-1 select-none cursor-pointer"
                           :class="message.detail" @click="checkDetail(item)"
                      >
                        <span>{{ $t('查看详情') }}</span>
                        <SvgIcon name="base/rx_ic_chevron_right" />
                      </div>
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
.title {
  color: var(--colors-text-text-primary);
  font-weight: 600;
}

.item {
  border-bottom: 1px solid var(--component-dropdown-divider, #6a757c);
  background: var(--colors-background-bg-overlay, #293038);

  &:last-of-type {
    border-bottom: none;
  }
}

.empty {
  :global(.p-badge) {
    display: none;
  }
}

.badge::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background-color: var(--component-rainbow-Red, #f53838);
  border-radius: 50%;
}

.noRead {
  background: var(--component-table-bg-selected);
  border-color: var(--component-table-border-selected);

  :global(.sys.text),
  :global(.teams strong) {
    color: var(--colors-text-text-brand);
    font-weight: 700;
  }
}

.text {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  line-height: 20px;
}

.time {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 16px;
}

.detail {
  color: var(--colors-text-text-brand);
  font-size: 12px;
}
</style>
