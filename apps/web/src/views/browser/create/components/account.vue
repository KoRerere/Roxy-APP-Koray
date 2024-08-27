<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import ryButton from '/@/components/ry-button'
import accountList from '/@/views/browser/components/drawers/account-list.vue'
import accountCreate from '/@/views/browser/components/drawers/account-create.vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emits = defineEmits(['update:modelValue'])

// const selectList = reactive<any[]>([])

const selectList = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    console.log('🚀 ~ set ~ value:', value)
    emits('update:modelValue', value)
  },
})

const drawer = reactive({
  visible: false,
  type: 'list',
})

function toggleDrawer(type: 'create' | 'list') {
  drawer.visible = true
  drawer.type = type
}

function deleteAccount(item: any) {
  const index = selectList.value.findIndex(it => it.name === item.name)
  selectList.value.splice(index, 1)
}

function confirm(data: any) {
  selectList.value.push(data)
}
</script>

<template>
  <div>
    <div class="button-group">
      <ry-button size="small" severity="secondary" icon="mdi mdi-swap-horizontal" label="Select"
        @click="toggleDrawer('list')" />
      <ry-button size="small" severity="secondary" icon="mdi mdi-plus" label="Add account"
        @click="toggleDrawer('create')" />
    </div>

    <div v-for="(item, index) in selectList" :key="index" class="card-list">
      <rx-card class="card-list-item" @close="deleteAccount(item)">
        <img class="card-list-item-img" :src="item.platformIcon">
        <div class="card-list-item-nation">
          {{ item.platformUrl }}
        </div>
        <div class="card-list-item-time">
          {{ item.platformName }}
        </div>
      </rx-card>
    </div>

    <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[50%]"
      :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <accountList v-if="drawer.type === 'list'" :close-drawer="closeCallback" />
        <accountCreate v-if="drawer.type === 'create'" :close-drawer="closeCallback" @confirm="confirm" />
      </template>
    </Drawer>
  </div>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-none, 0px);
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
}

.card-list {
  display: flex;
  flex-direction: column;
  margin-top: 10px;

  &-item {
    display: grid;
    grid-template-columns: 16px 1fr;
    grid-column-gap: var(--spacing-lg, 8px);
    grid-row-gap: var(--spacing-xs, 4px);

    &-img {
      width: 16px;
      height: 16px;
      grid-row-start: span 2;
    }

    &-nation {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &-time {
      color: var(--Colors-Text-text-inactive, #a3a9ad);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px);
    }
  }
}
</style>
