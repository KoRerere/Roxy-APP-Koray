<script setup lang="ts">
import type { TabProps } from 'primevue/tab'
import type { SvgNames } from '/@/components/rx-icon'

interface Props extends /* @vue-ignore */ TabProps {
  tabs: {
    title: string
    value: string
    icon?: string
    content?: string
    slot?: string
    render?: any
    [key: string]: any
  }[],
  onlyTabs?: boolean
  headTabs?: boolean
}

const { tabs, onlyTabs = false, headTabs = false, ...props } = defineProps<Props>()

const { tablist, tabpanels, ...slots }: any = useSlots()
</script>

<template>
  <Tabs :class="{ 'head-tabs': headTabs }" v-bind="props">
    <slot name="tablist">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          <slot name="tab" :data="tab">
            <div class="flex items-center gap-2">
              <SvgIcon v-if="tab.icon" :name="(tab.icon as SvgNames)" />
              <span>{{ tab.title }}</span>
            </div>
          </slot>
        </Tab>
      </TabList>
    </slot>
    <slot name="tabpanels" v-if="!onlyTabs">
      <TabPanels class="flex flex-1 !pa-0 overflow-hidden">
        <TabPanel class="flex flex-1 overflow-hidden" v-for="{ slot, render, panelProps, ...tab } in tabs" :key="tab.title" :value="tab.value" v-bind="panelProps">
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
  gap: 16px;
  padding: 0px 24px;
}

:deep(.p-tab) {
  padding: 8px;
  font-size: 12px;
  line-height: 16px;
}

:deep(.p-tab-active) {
  font-weight: 600;
}

.head-tabs {
  :deep(.p-tab) {
    padding: 14px 8px;
  }

  :deep(.p-tab-active) {
    font-size: 14px;
    color: var(--colors-text-text-primary);
  }
}
</style>
