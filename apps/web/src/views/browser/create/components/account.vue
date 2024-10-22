<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import { deepClone } from '/@/utils'
import accountCreate from '/@/views/account/create'
import accountList from '/@/views/account/list/quick.vue'

const windowPlatformList: any = defineModel('modelValue')

const selectedAccount = computed(() => windowPlatformList.value.filter((item: any) => item.id))

const drawer = reactive({
  dismissable: false,
  visible: false,
  type: 'list',
  data: undefined,
})

function toggleDrawer(type: 'create' | 'list', data?: any) {
  drawer.visible = true
  drawer.type = type
  drawer.dismissable = type === 'list'
  drawer.data = deepClone(data)
}

function onEdit(item: any) {
  if (item.id) {
    toggleDrawer('list')
  }
  else {
    toggleDrawer('create', item)
  }
}

function deleteAccount(item: any) {
  const index = windowPlatformList.value.findIndex((it: any) => it.name === item.name)
  windowPlatformList.value.splice(index, 1)
}

function onConfirm(data: any) {
  if (data._tempId) {
    replaceData(data)
    return
  }

  if (!data.id) {
    data._tempId = (new Date().getTime()).toString(32)
  }
  windowPlatformList.value.push(...([].concat(data)))
}

function replaceData(data: any) {
  const index = windowPlatformList.value.findIndex((item: any) => item._tempId === data._tempId)
  if (index > -1) {
    Reflect.set(windowPlatformList.value, index, data)
  }
}
</script>

<template>
  <div>
    <div class="button-group">
      <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_exchange" label="Select" @click="toggleDrawer('list')" />
      <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_plus" label="Add account" @click="toggleDrawer('create')" />
    </div>

    <div v-for="(item, index) in windowPlatformList" :key="index" class="card-list">
      <rx-card class="card-list-item" @click="onEdit(item)" @close="deleteAccount(item)">
        <img class="card-list-item-img" :src="item.platformIcon">
        <div class="card-list-item-nation">
          {{ item.platformUrl }}
        </div>
        <div class="card-list-item-time">
          {{ item.platformName }} {{ item.platformUserName }}
        </div>
      </rx-card>
    </div>

    <Drawer v-model:visible="drawer.visible" :dismissable="drawer.dismissable" position="right" class="browser-drawer-content !w-[50%]" :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <accountList v-if="drawer.type === 'list'" :data="{ windowPlatformList: selectedAccount }" @close="closeCallback" @confirm="(data: any) => { onConfirm(data); closeCallback() }" />
        <accountCreate v-if="drawer.type === 'create'" :title="$t('Create Account')" :data="drawer.data" @close="closeCallback" @confirm="onConfirm" />
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
