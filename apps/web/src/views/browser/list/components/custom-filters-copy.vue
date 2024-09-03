<!-- eslint-disable ts/ban-ts-comment -->
<script lang="ts" setup>
// @ts-ignore
import ryButton from '/@/components/ry-button'
import simplePopup from './inputs-popup.vue'
import { useDialog } from 'primevue/usedialog'
import { isEmptyValue, setInputValueByInputKey, sleep } from '/@/utils'

const _props = defineProps({
  ctmFilters: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emit = defineEmits(['update:list', 'filterChange', 'saveFilters'])
const dialog = useDialog()

const scvroptions = computed(() => _props.ctmFilters)

const scvroptionsItems = computed(() => scvroptions.value.filter((item: any) => item.type !== 'Separator' && !isEmptyValue(item.value)))

const menuRef = ref()
const isChildren = ref(false)
const subMenuOptions = ref()
const menuOptions = computed(() => isChildren.value ? subMenuOptions.value : scvroptions.value)

const selectedCategories = ref<string[]>([])

function showMenu(event: any) {
  menuRef.value.show(event)
}

function operationHandler(item: any) {
  switch (item.type) {
    case 'text':
    case 'number':
    case 'textarea':
    case 'date':
      inputPopup(item)
      break
    case 'switch':
      onSwitch(item)
      break
    case 'radio':
      // onSwitch(item)
      break
    case 'Checkbox':
      openChild(item)
      break
  }
}

function inputPopup(data: any) {
  menuRef.value.hide()
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data,
    emits: {
      onSave: ([formData, close]: [any, () => void]) => {
        Object.entries(formData).forEach(([name, value]) => {
          setInputValueByInputKey(scvroptions.value, name, 'value', value)
        })
        emit('filterChange')
        close()
      },
    },
  })
}

function onSwitch(item: any, value: any = true) {
  item.value = value
  menuRef.value.hide()
  emit('filterChange')
}

function openChild(item: any) {
  if (item.options) {
    sleep(20).then(() => {
      isChildren.value = true
      subMenuOptions.value = item.options
      selectedCategories.value = item.value
    })
    return
  }
  menuRef.value.hide()
}

function onHide() {
  if (isChildren.value) {
    selectedCategories.value = []
    sleep(20).then(() => {
      isChildren.value = false
      emit('filterChange')
    })
  }
}

function onChange(item: any) {
  scvroptions.value.find(input => input.name === item.parentName).value = toRaw(selectedCategories.value)
}

function deleteFilterItem(item: any) {
  setInputValueByInputKey(scvroptions.value, item.name, 'value', null)
  emit('filterChange')
}

function saveFilters() {
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      type: 'text',
      label: 'Save filter',
      placeholder: 'filter name...',
      name: 'filter_name',
      required: true,
    },
    emits: {
      onSave: ([formData, close]: [any, () => void]) => {
        emit('saveFilters', formData)
        close()
      },
    },
  })
}
</script>

<template>
  <div class="flex gap-2 filter-list">
    <div v-for="(item, index) in scvroptionsItems" :key="index" class="filter-item">
      <span class="mdi mdi-close cursor-pointer filter-item-icon" @click="deleteFilterItem(item)" />
      <span class="select-none">{{ item.label }}:</span>
      <span class="cursor-pointer">{{ item.value }}</span>
    </div>

    <ryButton class="filter-button" text @click="showMenu">
      <span class="mdi mdi-filter-variant" />
      <span v-if="!scvroptionsItems.length">Add filters</span>
    </ryButton>
    <ryButton>clear</ryButton>
    <ryButton @click="saveFilters">
      save filter
    </ryButton>
  </div>
  <!-- <RadioButton v-if="item.type === 'RadioButton'" v-model="selectedCategories.value" :input-id="item.name"
            :name="item.parentName" :value="item" @click.stop @change="change" /> -->
  <TieredMenu ref="menuRef" :model="menuOptions" popup
    :pt="{ separator: 'browser-separator', menu: { transition: 'browser-content' } }" @hide="onHide">
    <template #item="{ item, props }">
      <a v-ripple class="cursor-pointer !p-0" v-bind="props.action">
        <label v-if="isChildren" class="cursor-pointer browser-item" :for="item.value" @click.stop>
          <Checkbox v-model="selectedCategories" :name="item.parentName" :input-id="item.value" :value="item.value"
            @click.stop @change="() => onChange(item)" />
          <span>{{ item.label }}</span>
        </label>
        <div v-else class="browser-item" @click.stop="operationHandler(item)">
          <span :class="item.icon" />
          <span>{{ item.label }}</span>
        </div>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss">
.browser {
  &-content {
    padding: var(--spacing-md, 6px) var(--spacing-sm, 4px) !important;
  }

  &-separator {
    margin: var(--spacing-md, 6px) 0;
  }

  &-item {
    display: flex;
    align-items: center;
    padding: 8px var(--spacing-md, 6px) 8px 10px !important;
    gap: var(--spacing-md, 6px) !important;
    width: 100%;
  }
}
</style>

<style lang="scss" scoped>
.filter-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm, 4px) 8px var(--spacing-sm, 4px) 10px;
  gap: var(--spacing-sm, 4px);
  border-radius: var(--radius-full, 9999px);
  border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
  background: var(--Colors-Background-bg-body-hover, #f0f3f5);

  color: var(--Colors-Text-text-action-secondary, #171c1f);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &-icon {
    font-size: 14px;
  }
}

.filter-button {
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
