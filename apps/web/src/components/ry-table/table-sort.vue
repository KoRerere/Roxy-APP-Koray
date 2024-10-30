<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
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
  _sorts.value.forEach(item => item.value = item.defaultValue)
  onUpdate()
}

function onUpdate() {
  popRef.value.getRef().hide()
  emits('sort', getFormData(_sorts.value))
}
</script>

<template>
  <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_sort_ascending" :label="$t('排序')" @click="toggle" />
  <RyPopover ref="popRef">
    <div :class="classes.content">
      <div v-for="item in _sorts" :key="item.name" :class="classes.item">
        <RxSvgIcon :name="item.icon" :size="16" />
        <span class="flex-1">{{ item.label }}</span>
        <div class="flex-1">
          <RxInputSelect v-model="item.value" v-bind="{ optionValue: 'value', filter: false, name: item.label, options: item.options, placeholder: item.placeholder }" checkmark
            :highlight-on-select="false" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <RxButton size="sm" severity="secondary" text :label="$t('重置')" @click="onReset" />
        <RxButton size="sm" severity="info" :label="$t('保存')" @click="onUpdate" />
      </div>
    </template>
  </RyPopover>
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
  color: var(--Color-neutrals-700, #343a3d);
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
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  border-radius: var(--radius-sm, 4px);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
