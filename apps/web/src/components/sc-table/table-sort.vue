<script setup lang="ts">
import scPopover from '/@/components/sc-popover'

defineProps({
  filters: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emits = defineEmits(['sort'])

const popRef = ref()

const _filters = ref([
  {
    key: 'city',
    label: '城市',
    icon: 'mdi-sort-descending',
    placeholder: '请选择城市',
    value: null,
    options: [
      { name: 'New York', value: 'NY' },
      { name: 'Rome', value: 'RM' },
      { name: 'London', value: 'LDN' },
      { name: 'Istanbul', value: 'IST' },
      { name: 'Paris', value: 'PRS' },
    ],
  },
  {
    key: 'order',
    label: '排序',
    icon: 'mdi-sort-descending',
    placeholder: '请选择排序',
    value: null,
    options: [
      { name: '升序', value: 'NY' },
      { name: '降序', value: 'RM' },
    ],
  },
])

function toggle(event: Event) {
  popRef.value.toggle(event)
}

function getFilterData() {
  return _filters.value.reduce((acc, item) => {
    acc[item.key] = item.value
    return acc
  }, {} as Record<string, any>)
}

function update() {
  const data = getFilterData()
  emits('sort', data)
}
</script>

<template>
  <div v-ripple class="flex-cc cursor-pointer sort-icon" @click="toggle">
    <span class="font-size-sm leading-none mdi mdi-sort-ascending " />
  </div>
  <sc-popover ref="popRef" footer class="sort-popover">
    <div v-for="item in _filters" :key="item.key" class="sort-popover-item">
      <span class="mdi" :class="item.icon" />
      <span class="w-full">{{ item.label }}</span>
      <Select v-model="item.value" :options="item.options" :placeholder="item.placeholder" option-label="name"
              option-value="value" checkmark :highlight-on-select="false"
      />
    </div>
    <template #footer>
      <Button text>
        Reset
      </Button>
      <Button severity="info" @click="update">
        Save filter
      </Button>
    </template>
  </sc-popover>
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
  border-radius: 4px;
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border-hover, #a3a9ad);
  background: var(--Component-Colors-Buttons-Secondary-bg-hover, #f2f5f7);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
