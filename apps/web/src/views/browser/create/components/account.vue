<script setup lang="ts">
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import AccountCreate from '/@/views/account/create/quick.vue'
import AccountList from '/@/views/account/list/quick.vue'
import PlatformIcon from '/@/views/account/list/platform-icon.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { deepClone } from '/@/utils'
import { useDrawer } from '/@/hooks/useDrawer'
import { useTableContext } from '../hooks/useContext'
import { AccountBindType } from '/@/enums/account'

defineOptions({
  inheritAttrs: false,
})

const { isBatch, createCount } = useTableContext()
const attrs = useAttrs()
const drawerInstance = useDrawer()
const windowPlatformList = defineModel<any[]>('modelValue')
const accountType = defineModel<number>('type', { default: AccountBindType.Order })

const input = ref<Record<string, any>>({
  type: 'select',
  name: 'platformBindType',
  props: {
    placeholder: $t('请输入或选择平台网址'),
    optionValue: 'value',
    options: [
      {
        label: $t('顺序分配'),
        value: AccountBindType.Order
      },
      {
        label: $t('应用于所有窗口'),
        value: AccountBindType.MultiWindow
      }
    ]
  }
})

const selectedAccount = computed(() => windowPlatformList.value?.filter((item: any) => item.id))
const sumAccountCount = computed(() => windowPlatformList.value?.length ?? 0)

function toggleDrawer(addType: 'create' | 'list', item?: any) {
  const dismissable = addType === 'list'
  const title = dismissable ? $t('平台账号列表') : $t('添加平台账号')
  const data = dismissable ? { windowPlatformList: selectedAccount.value } : deepClone(item)
  const RenderComponent = dismissable ? AccountList : AccountCreate

  drawerInstance.showDrawer({
    title,
    dismissable,
    slots: {
      container: () => h(RenderComponent, {
        data,
        isBatch: isBatch.value,
        createCount: createCount.value,
        accountType: accountType.value,
        onClose: () => drawerInstance.hideDrawer(),
        onConfirm: (formData: Record<string, any>) => {

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
  <div class="w-full flex flex-col gap-3">
    <div class="flex items-center self-stretch gap-2">
      <div class="flex-1 items-center flex gap-2">
        <div class="title">{{ attrs.label }}</div>
        <div v-if="isBatch" class="flex items-center gap-2">
          <TsFormSelect v-model="accountType" v-bind="input.props" />
          <SvgIcon v-tooltip="{ value: $t('顺序分配: 账号顺序分配给窗口，一个窗口应用一个账号\n应用于所有窗口: 将账号应用到所有窗口'), showDelay: 300, pt: { root: '!max-w-65' } }" name="base/rx_ic_info"
            color="var(--colors-icon-icon-note)" />
        </div>
      </div>
      <RxButton text size="xxs" severity="secondary" icon="base/rx_ic_exchange" :label="$t('选择')" @click="toggleDrawer('list')" />
      <RxButton text size="xxs" severity="secondary" icon="base/rx_ic_plus" :label="$t('添加')" @click="toggleDrawer('create')" />
    </div>

    <RxAlert v-if="isBatch && accountType === AccountBindType.Order && sumAccountCount > createCount" class="w-full" type="warn"
      :title="$t('{count} 个窗口将会绑定账号。您创建的窗口数为：{max}。{message}', { count: sumAccountCount, max: createCount, message: $t('当前选择绑定的账号数量已超过创建窗口数。') })" :closable="false"></RxAlert>
    <div v-if="windowPlatformList?.length">
      <div v-if="isBatch" class="mb-2 subtitle">{{ $t('账号列表 ({count})', { count: sumAccountCount }) }}</div>
      <div class="grid gap-2 list">
        <RxCard class="flex gap-2 items-start overflow-hidden" v-for="(item, index) in windowPlatformList" :key="index" :closable="false" @click="onEdit(item)">
          <div class="mt-0.5">
            <PlatformIcon v-if="item.platformIcon" class="icon" :platformIcon="item.platformIcon" :platformIconDark="item.platformIconDark" />
            <RxSvgIcon v-else name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary, #7C8387)" />
          </div>
          <div class="flex-1 flex flex-col gap-1 overflow-hidden">
            <div class="flex items-center gap-2 region">{{ item.platformUrl }}</div>
            <div class="flex items-center gap-1.5 info">{{ item.platformUserName || '--' }}</div>
          </div>
          <div class="mt-0.5 flex gap-2">
            <RxSvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="deleteAccount(item)" />
          </div>
        </RxCard>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 13px;
  line-height: 16px;
}

.list {
  grid-template-columns: repeat(2, 1fr);
}

.icon {
  width: 16px;
  height: 16px;
}

.region {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.info {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}
</style>
