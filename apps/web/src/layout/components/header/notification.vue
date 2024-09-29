<script lang="ts" setup>
import type { UserGetNotifyListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { NotifyModule, NotifyStatus } from '/@/enums'

type Message = UserGetNotifyListData['data'][0]

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
    title: 'Teams',
    list: [],
    noRead: 0,
  },
  {
    value: 'sys',
    title: 'System',
    list: [],
    noRead: 0,
  },
])

const tabsValue = ref('teams')

function toggle(event: Event) {
  getMessageList()

  pop.value.getRef().toggle(event)
}

async function getMessageList() {
  const { data } = await API.base.userGetNotifyList()
  const [teamsTab, sysTab] = tabs.value

  const { teams, sys, teamsRead, sysRead } = data.reduce((acc, item) => {
    if (item.messageModule === NotifyModule.team) {
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
  const items = ([] as Message[]).concat(item)
  const ids = items.map(item => item.id)
  await API.base.userReadNotifyCreate({ ids })
  tabs.value.find(tab => tab.value === tabsValue.value)!.noRead -= ids.length
  items.forEach(item => item.status = NotifyStatus.read)
}

function markAllAsRead() {
  const list = tabs.value.find(tab => tab.value === tabsValue.value)!.list.filter(item => item.status === NotifyStatus.unread)
  list?.length && onRead(list)
}
</script>

<template>
  <div class="flex justify-center">
    <ry-button icon="base/rx_ic_mail" outlined size="small" @click="toggle" />
    <RyPopover ref="pop">
      <div :class="message.wrapper">
        <div :class="message.header">
          <div :class="message.title">
            Message
          </div>
          <RyButton severity="secondary" :class="message.read" size="small" text icon="base/rx_ic_done"
            label="Mark all as read" @click="markAllAsRead" />
        </div>
        <Tabs v-model:value="tabsValue">
          <TabList :pt="{ tablist: 'px-4 gap-4' }">
            <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value"
              class="flex flex-1 justify-center items-center gap-1.5">
              <span>{{ tab.title }}</span>
              <Badge v-if="tab.noRead" :value="tab.noRead" severity="danger" size="small" />
            </Tab>
          </TabList>
          <TabPanels class="!pa-0">
            <TabPanel v-for="tab in tabs" :key="tab.title" :value="tab.value">
              <template v-if="tab.list?.length">
                <div v-for="item in tab.list" :key="item.id" class="flex" :class="message.item" @click="onRead(item)">
                  <div :class="[message.avatar, !item.status && message.badge]">
                    <Avatar :image="item.avatar || 'https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png'"
                      shape="circle" />
                  </div>
                  <div>
                    <div :class="message.value">
                      {{ item.notify }}
                    </div>
                    <div :class="message.time">
                      {{ item.createTime }}
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex justify-center items-center min-h-40 text-6">
                  No Message
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
  padding: var(--spacing-md, 8px) 16px;
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
  color: var(--Colors-Text-text-secondary, #575d61);
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.time {
  margin-top: 4px;
  color: var(--Colors-Text-text-inactive, #a3a9ad);
  font-size: 10px;
  line-height: 12px;
}
</style>
