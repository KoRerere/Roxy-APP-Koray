<script lang="ts" setup>
import type { UserGetNotifyListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { NotifyModule, NotifyStatus } from '/@/enums'
import { $t } from '/@/locales'
import { emitter } from '/@/utils/eventBus'

type Message = UserGetNotifyListData['data'][0] & { isInWorkspace?: boolean }

interface Tab {
  value: string
  title: string
  list: Message[]
  noRead: number
}

const pop = ref()
const tabs = ref<Tab[]>([
  {
    value: 'teams',
    title: $t('团队通知'),
    list: [],
    noRead: 0,
  },
  {
    value: 'sys',
    title: $t('系统通知'),
    list: [],
    noRead: 0,
  },
])

const tabsValue = ref('teams')

const noRead = computed(() => tabs.value.reduce((acc, tab) => acc + tab.noRead, 0))

function toggle(event: Event) {
  getMessageList()

  pop.value.getRef().toggle(event)
}

async function getMessageList() {
  const { data } = await API.base.userGetNotifyList()
  const [teamsTab, sysTab] = tabs.value

  const { teams, sys, teamsRead, sysRead } = (data ?? []).reduce((acc, item) => {
    if (item.messageModule === NotifyModule.teams) {
      acc.teams.push(item)
      acc.teamsRead += item.status
    }
    else {
      acc.sys.push(item)
      acc.sysRead += item.status
    }
    return acc
  }, { teams: [], sys: [], teamsRead: 0, sysRead: 0 } as any)

  teamsTab.noRead = teams.length - teamsRead
  sysTab.noRead = sys.length - sysRead
  teamsTab.list = teams
  sysTab.list = sys
}

async function onRead(item: Message | Message[]) {
  if (!Array.isArray(item) && item.status === NotifyStatus.read)
    return

  const items = ([] as Message[]).concat(item)
  const ids = items.map(item => item.id)
  await API.base.userReadNotifyCreate({ ids: ids as number[] })
  tabs.value.find(tab => tab.value === tabsValue.value)!.noRead -= ids.length
  items.forEach(item => item.status = NotifyStatus.read)
}

function markAllAsRead() {
  const list = tabs.value.find(tab => tab.value === tabsValue.value)!.list.filter(item => item.status === NotifyStatus.unread)
  list?.length && onRead(list)
}

function checkDetail(item: Message) {
  if (item.type === '邀请用户通知') {
    emitter.emit('viewInviteDetail', item.paramData)
  }
}

onMounted(() => {
  getMessageList()
})
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
          <TabList :pt="{ tablist: 'px-4 gap-4 h-[40px]', activeBar: '!h-[2px]' }">
            <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value" class="flex flex-1 justify-center items-center gap-1.5">
              <span>{{ tab.title }}</span>
              <Badge v-if="tab.noRead" :value="tab.noRead" severity="danger" size="small" />
            </Tab>
          </TabList>
          <TabPanels class="!pa-0 min-h-[100px] max-h-[280px] overflow-auto">
            <TabPanel v-for="tab in tabs" :key="tab.title" :value="tab.value">
              <template v-if="tab.list?.length">
                <div v-for="item in tab.list" :key="item.id" class="flex" :class="message.item" @click="onRead(item)">
                  <div :class="[message.avatar, !item.status && message.badge]">
                    <RxAvatar class="cursor-pointer mr-2" :avatar="item.avatar" :name="item.userName?.slice(0, 2)" :color="item.avatarColor" :size="32" :font-size="18" />
                  </div>
                  <div>
                    <div :class="message.value">
                      {{ item.notify }}
                    </div>
                    <div :class="message.time" class="w-full flex justify-between">
                      <span>
                        {{ item.createTime }}
                      </span>
                      <span
                        v-if="item.paramData"
                        :class="message['check-detail']"
                        @click="checkDetail(item)"
                      >
                        {{ $t('查看详情') }}
                      </span>
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
  color: var(--Colors-Text-text-primary, #171c1f);
  font-weight: 600;
}

.read {
  color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
  font-size: var(--Font-Size-text-sm, 12px);
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.item {
  display: flex;
  padding: var(--spacing-xl, 12px) var(--spacing-2xl, 16px);
  align-items: flex-start;
  gap: 10px;
  border-bottom: 1px solid var(--Colors-Border-border-subtle, #e4e8eb);
  background: var(--Colors-Background-bg-body, #fff);

  &:last-of-type {
    border-bottom: none;
  }
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
      background-color: var(--Color-Rainbow-Red, #f53838);
      border-radius: 50%;
    }
  }
}

.value {
  word-break: break-all;
  color: var(--Colors-Text-text-secondary, #575d61);
  font-size: 14px;
  line-height: var(--Line-Height-text-md, 20px);
}

.check-detail {
  color: var(--Colors-Text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
  cursor: pointer;
}

.check-detail.disabled {
  color: var(--Colors-Text-text-inactive, #a3a9ad);
  cursor: not-allowed;
}

.time {
  margin-top: 4px;
  color: var(--Colors-Text-text-inactive, #a3a9ad);
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
