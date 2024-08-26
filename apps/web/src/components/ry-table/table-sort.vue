<script setup lang="ts">
import ryPopover from '/@/components/ry-popover'
import { formatInputs } from '/@/utils'

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
  _sorts.value.forEach((item) => {
    item.value = null
  })
  onUpdate()
}

function onUpdate() {
  popRef.value.getRef().hide()
  emits('sort', formatInputs(_sorts.value))
}
</script>

<template>
  <div v-ripple class="cursor-pointer sort-icon" @click="toggle">
    <span class="font-size-[16px] leading-none mdi mdi-sort-ascending " />
  </div>

  <ry-popover ref="popRef" footer class="sort-popover">
    <div v-for="item in _sorts" :key="item.name" class="sort-popover-item">
      <span class="mdi" :class="item.icon" />
      <span class="w-full">{{ item.label }}</span>
      <Select v-model="item.value" :options="item.options" :placeholder="item.placeholder" option-label="label"
        option-value="value" checkmark :highlight-on-select="false" />
    </div>
    <template #footer>
      <Button text @click="onReset">
        Reset
      </Button>
      <Button severity="info" @click="onUpdate">
        Save filter
      </Button>
    </template>
  </ry-popover>
</template>

<style lang="scss">
.sort-popover {
  &-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm, 4px);
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    width: 280px;
  }
}
</style>

<style lang="scss" scoped>
.sort-icon {
  display: flex;
  padding: var(--spacing-sm, 4px);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm, 4px);

  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
