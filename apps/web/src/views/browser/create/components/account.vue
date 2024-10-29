<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import { $t } from '/@/locales'
import { deepClone } from '/@/utils'
import AccountCreate from '/@/views/account/create'
import AccountList from '/@/views/account/list/quick.vue'

const windowPlatformList: any = defineModel('modelValue')

const selectedAccount = computed(() => windowPlatformList.value.filter((item: any) => item.id))

const drawer = reactive({
  title: '',
  dismissable: false,
  visible: false,
  type: 'list',
  data: undefined,
})

function toggleDrawer(type: 'create' | 'list', data?: any) {
  drawer.visible = true
  drawer.type = type
  drawer.dismissable = type === 'list'
  drawer.title = type === 'list' ? $t('平台账号列表') : $t('添加平台账号')
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

  if (!Array.isArray(data) && !data.id) {
    data._tempId = (new Date().getTime()).toString(32)
    windowPlatformList.value.push(data)
  }
  else {
    const list = windowPlatformList.value.filter((item: any) => !item.id)
    windowPlatformList.value = list.concat(data)
  }
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
      <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_exchange" :label="$t('选择')" @click="toggleDrawer('list')" />
      <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_plus" :label="$t('添加')" @click="toggleDrawer('create')" />
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

    <RxDrawer v-model:visible="drawer.visible" :dismissable="drawer.dismissable" :title="drawer.title">
      <template #default="{ closeCallback }">
        <AccountList v-if="drawer.type === 'list'" :data="{ windowPlatformList: selectedAccount }" @close="closeCallback" @confirm="(data: any) => { onConfirm(data); closeCallback() }" />
        <AccountCreate v-if="drawer.type === 'create'" :data="drawer.data" @close="closeCallback" @confirm="onConfirm" />
      </template>
    </RxDrawer>
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
