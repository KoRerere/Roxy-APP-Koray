<script setup lang="ts">
import Drawer from 'primevue/drawer'

interface Props {
  title: string,
  position?: 'left' | 'right' | 'top' | 'bottom' | 'full'
  pt?: Record<string, any>
}

const { title, position = 'right', pt } = defineProps<Props>()

const cssModule = useCssModule()

const passThrough = {
  mask: cssModule.mask,
  root: cssModule.root,
  ...pt,
}
</script>

<template>
  <Drawer :position="position" :pt="passThrough" v-bind="$attrs">
    <template #container="{ closeCallback }">
      <slot name="header" :closeCallback="closeCallback">
        <div class="flex justify-between items-center self-stretch gap-3 py-2 pl-4 pr-3" :class="cssModule.header">
          <div :class="cssModule.title">{{ title }}</div>
          <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_delete" @click="closeCallback" />
        </div>
      </slot>
      <div class="flex-1 overflow-hidden">
        <slot name="container"></slot>
      </div>
    </template>
  </Drawer>
</template>

<style lang="scss" module>
.mask {
  padding: var(--spacing-xl, 12px);

  &:global(.p-drawer-left .p-drawer),
  &:global(.p-drawer-right .p-drawer) {
    width: auto;
    max-width: 100%;
  }
}

.root {
  &:global(.p-drawer) {
    border-radius: var(--radius-lg, 8px);
    border-width: 0.5px;
    box-shadow:
      0px 1px 1px 0px rgba(0, 0, 0, 0.04),
      0px 2px 8px 0px rgba(0, 0, 0, 0.04),
      0px 3px 17px 0px rgba(0, 0, 0, 0.04),
      0px 4px 30px 0px rgba(0, 0, 0, 0.12);
  }
}

.header {
  border-bottom: 0.5px solid var(--colors-border-divider);
}

.title {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 14px;
  font-weight: 600;
  line-height: var(--Line-Height-text-sm, 18px);
}
</style>
