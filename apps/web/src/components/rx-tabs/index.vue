<script setup lang="ts">
import type { TabProps } from 'primevue/tab'

interface Props extends /* @vue-ignore */ TabProps {
  tabs: {
    title: string
    value: string
    content?: string
    slot?: string
    render?: any
    [key: string]: any
  }[],
  onlyTabs?: boolean
}

const { tabs, onlyTabs = false, ...props } = defineProps<Props>()

const { tablist, tabpanels, ...slots }: any = useSlots()
</script>

<template>
  <Tabs v-bind="props">
    <slot name="tablist">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
    </slot>
    <slot name="tabpanels" v-if="!onlyTabs">
      <TabPanels class="flex flex-1 !pa-0 overflow-hidden">
        <TabPanel class="flex flex-1" v-for="{ slot, render, panelProps, ...tab } in tabs" :key="tab.title"
          :value="tab.value" v-bind="panelProps">
          <slot :name="slot || tab.title" :tab="tab">
            <component v-if="render" :is="render" />
            <template v-else>{{ tab.content }}</template>
          </slot>
        </TabPanel>
      </TabPanels>
    </slot>
    <template v-for="(_, name) in slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps"></slot>
    </template>
  </Tabs>
</template>

<style lang="scss" scoped>
:deep(.p-tablist-tab-list) {
  gap: var(--spacing-2xl, 16px);
  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  .p-tab {
    padding: 14px 8px;
    border-color: transparent;
    color: var(--colors-text-text-secondary, #B2B6B8);
    font-size: 12px;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);

    &:not(.p-tab-active):not(.p-disabled):hover {
      border-color: transparent;
    }
  }

  .p-tab-active {
    font-size: 14px;
    font-weight: 700;
    color: var(--colors-text-text-primary, #FAFAFA);
  }

  .p-tablist-active-bar {
    height: 2px;
  }
}
</style>
