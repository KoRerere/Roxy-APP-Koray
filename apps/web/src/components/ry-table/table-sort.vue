<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { getFormData } from '/@/utils'

const props = defineProps({
  sorts: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emits = defineEmits(['sort'])
const _sorts = ref(props.sorts)

const popRef = ref()
function toggle(event: Event) {
  popRef.value.getRef().toggle(event)
}

function onReset() {
  _sorts.value.forEach(item => item.value = null)
  onUpdate()
}

function onUpdate() {
  popRef.value.getRef().hide()
  emits('sort', getFormData(_sorts.value))
}
</script>

<template>
  <div v-ripple class="cursor-pointer sort-icon" @click="toggle">
    <RxSvgIcon name="base/rx_ic_sort_ascending" />
  </div>
  <ryPopover ref="popRef">
    <div :class="classes.content">
      <div v-for="item in _sorts" :key="item.name" :class="classes.item">
        <RxSvgIcon :name="item.icon" :size="16" />
        <span class="flex-1">{{ item.label }}</span>
        <Select v-model="item.value" :options="item.options" :placeholder="item.placeholder" option-label="label"
                option-value="value" checkmark :highlight-on-select="false"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <ryButton size="small" severity="secondary" text label="Reset" @click="onReset" />
        <ryButton size="small" severity="info" label="Save filter" @click="onUpdate" />
      </div>
    </template>
  </ryPopover>
</template>

<style lang="scss" module="classes">
.content {
  padding: var(--spacing-md, 6px) var(--spacing-sm, 4px);
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm, 4px);
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  min-width: 300px;
}
</style>

<style lang="scss" scoped>
.sort-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 30px;
  height: 30px;
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  border-radius: var(--radius-sm, 4px);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
