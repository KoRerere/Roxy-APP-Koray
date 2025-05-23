<script setup lang="ts">
import AccountCreate from '/@/views/account/create'
import AccountList from '/@/views/account/list/quick.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { deepClone } from '/@/utils'
import { useDrawer } from '/@/hooks/useDrawer'

const drawerInstance = useDrawer()

const windowPlatformList = defineModel<any[]>('modelValue')
const selectedAccount = computed(() => windowPlatformList.value?.filter((item: any) => item.id))

function toggleDrawer(type: 'create' | 'list', item?: any) {
  const dismissable = type === 'list'
  const title = dismissable ? $t('平台账号列表') : $t('添加平台账号')
  const data = dismissable ? { windowPlatformList: selectedAccount.value } : deepClone(item)
  const RenderComponent = dismissable ? AccountList : AccountCreate

  drawerInstance.showDrawer({
    title,
    dismissable,
    slots: {
      container: () => h(RenderComponent, {
        data,
        onClose: () => drawerInstance.hideDrawer(),
        onConfirm: (formData: Record<string, any>) => {
          drawerInstance.hideDrawer()

          if (formData._tempId) {
            replaceData(formData)
            return
          }
          if (!Array.isArray(formData) && !formData.id) {
            windowPlatformList.value!.push({
              ...formData,
              _tempId: Date.now().toString(32)
            })
          } else {
            windowPlatformList.value = windowPlatformList.value!.filter(item => !item.id).concat(formData)
          }
        }
      })
    }
  })
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
  windowPlatformList.value = windowPlatformList.value!.filter((it: any) => (it._tempId || it.id) !== (item._tempId || item.id))
}

function replaceData(data: any) {
  const index = windowPlatformList.value!.findIndex((item: any) => item._tempId === data._tempId)!
  if (index > -1) {
    Reflect.set(windowPlatformList.value!, index, data)
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
          <RxSvgIcon v-else name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary, #7C8387)" />
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
    color: var(--colors-text-text-primary, #fafafa);
    font-weight: 500;
  }

  &-subtitle {
    color: var(--colors-text-text-inactive, #a3a9ad);
  }
}
</style>
