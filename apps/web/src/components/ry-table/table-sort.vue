<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'

const props = defineProps({
  sorts: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emits = defineEmits(['sort'])
const _sorts = ref(props.sorts)
const changed = computed(() => props.sorts.some(item => item.value !== item.defaultValue))

const popRef = ref()
function toggle(event: Event) {
  popRef.value.getRef().toggle(event)
}

function onReset() {
  _sorts.value?.forEach(item => item.value = item.defaultValue)
  onUpdate()
}

function onUpdate() {
  emits('sort')
}
</script>

<template>
  <div class="flex flex-col w-full">
    <div v-for="item in _sorts" :key="item.name" :class="classes.item">
      <RxSvgIcon :name="item.icon" :size="16" />
      <span class="flex-1">{{ item.label }}</span>
      <div class="flex-1">
        <RxInputSelect v-model="item.value" size="xxs"
          v-bind="{ optionValue: 'value', filter: false, name: item.label, options: item.options, placeholder: item.placeholder }"
          checkmark :highlight-on-select="false" @change="onUpdate" />
      </div>
    </div>
  </div>
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
  padding: var(--spacing-sm, 4px) 0;
  color: var(--primitives-neutrals-700, #343a3d);
  font-family: Inter;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
}
</style>

<style lang="scss" scoped>
.sort-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 30px;
  height: 30px;
  border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
  border-radius: var(--radius-sm, 4px);
  background: var(--colors-background-bg-action, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}

.changed {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #12a3fc;
}
</style>
