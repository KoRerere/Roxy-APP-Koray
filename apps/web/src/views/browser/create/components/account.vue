<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
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
  windowPlatformList.value = windowPlatformList.value.filter((it: any) => (it._tempId || it.id) !== (item._tempId || item.id))
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
      <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_exchange" :label="$t('选择')"
        @click="toggleDrawer('list')" />
      <RxButton outlined size="xxs" severity="secondary" icon="base/rx_ic_plus" :label="$t('添加')"
        @click="toggleDrawer('create')" />
    </div>

    <div v-for="(item, index) in windowPlatformList" :key="index" class="account">
      <RxCard class="flex gap-2" @click="onEdit(item)" @close="deleteAccount(item)">
        <div>
          <img v-if="item.platformIcon" class="w-4 h-4" :src="item.platformIcon">
          <RxSvgIcon v-else name="base/rx_ic_user_key" color="var(--Colors-Icon-icon-tertiary, #7C8387)" />
        </div>
        <div class="flex flex-col flex-1 gap-1">
          <div class="flex items-center account-title">
            {{ item.platformUrl }}
          </div>
          <div class="flex items-center gap-1.5 account-subtitle">
            {{ item.platformUserName }}
          </div>
        </div>
      </RxCard>
    </div>

    <RxDrawer v-model:visible="drawer.visible" :dismissable="drawer.dismissable" :title="drawer.title">
      <template #default="{ closeCallback }">
        <AccountList v-if="drawer.type === 'list'" :data="{ windowPlatformList: selectedAccount }"
          @close="closeCallback" @confirm="(data: any) => { onConfirm(data); closeCallback() }" />
        <AccountCreate v-if="drawer.type === 'create'" :data="drawer.data" @close="closeCallback"
          @confirm="onConfirm" />
      </template>
    </RxDrawer>
  </div>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  height: var(--Line-Height-display-xs, 32px);
}

.account {
  margin-top: 10px;
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);

  &-title {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-subtitle {
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
