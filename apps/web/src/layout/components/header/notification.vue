<script setup>
import { RxSvgIcon } from '/@/components/rx-icon'

const pop = ref()

const tabs = ref([
  {
    value: '0',
    title: 'Teams',
    content: 'Tab 1 Content',
  },
  {
    value: '1',
    title: 'System',
    content: 'Tab 2 Content',
  },
])

function toggle (event) {
  pop.value.getRef().toggle(event)
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
            label="Mark all as read" />
        </div>
        <Tabs value="0">
          <TabList :pt="{ tablist: 'px-4 gap-4' }">
            <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value"
              class="flex flex-1 justify-center items-center gap-1.5">
              <span>{{ tab.title }}</span>
              <Badge value="3" severity="danger" size="small" />
            </Tab>
          </TabList>
          <TabPanels class="!pa-0">
            <TabPanel v-for="tab in tabs" :key="tab.content" :value="tab.value">
              <div v-for="i in 3" :key="i" class="flex" :class="message.item">
                <OverlayBadge severity="danger" class="inline-flex">
                  <Avatar image="https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png" shape="circle" />
                </OverlayBadge>
                <div>
                  <div :class="message.value">
                    Jason Chan just invite you into Amazon's Working Space Store
                  </div>
                  <div :class="message.time">
                    6 hours ago
                  </div>
                </div>
              </div>
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
