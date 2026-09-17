<script lang="ts" setup>
import PlatformIcon from '/@/views/account/list/components/platform-icon.vue'
import TsForm from '/@/views/lab/components/form/index.vue'
import { API } from '/@/api'

import { deepClone } from '/@/utils'
import { isEqual } from 'es-toolkit'
import { useConfirm } from 'primevue/useconfirm'
import { useThemeStore } from '/@/stores/theme'

interface Props {
  datas?: Record<string, any>[]
}

const { datas = [] } = defineProps<Props>()

const emit = defineEmits(['confirm'])
const confirm = useConfirm()

const _datalist = ref<Record<string, any>[]>(datas.map((item, index) => ({ ...item, tid: (Date.now() + index ** 2).toString(32), invalid: false })))
const rawRelatedMap = Object.fromEntries(_datalist.value.filter(item => !!item.id).map(item => [item.id, deepClone(item)]))
const activeBar = ref(_datalist.value[0]!)
/**
 * 需要解绑的账号库账号 ids
 */
const platformUrlIds = ref<any[]>([])

const formRef = useTemplateRef<any>('account')

const platformRow = ref<any[]>([])
const themeStore = useThemeStore()

const inputs = [
  {
    type: 'select',
    label: $t('平台'),
    name: 'platformUrl',
    props: {
      placeholder: $t('请输入或选择平台网址'),
      optionValue: 'value',
      editable: true,
      getOptions: async () => {
        const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
        return rows.map(item => ({
          image: item.platformIcon,
          label: item.platformUrl,
          value: item.platformUrl,
        }))
      },
      onChange: ({ value, props }: any) => {
        const platform = props.options.find((item: any) => item.value === value)
        Reflect.set(activeBar.value, 'platformIcon', platform.platformIcon)
        Reflect.set(activeBar.value, 'platformIconDark', platform.platformIconDark)
        Reflect.set(activeBar.value, 'invalid', !value)
        // formRef.value?.setValues({ platformName: platform.value.replace(/^https?:\/\//, '').replace(/\/.*$/, '') })
      },
    },
    resolver: (zod: any) => zod.string().url($t('请输入正确的平台网址')),
  },
  // {
  //   type: 'text',
  //   label: $t('平台名'),
  //   name: 'platformName',
  //   props: {
  //     placeholder: $t('请输入平台名'),
  //   },
  // },
  {
    type: 'text',
    label: $t('账号'),
    name: 'platformUserName',
    props: {
      placeholder: $t('请输入账号'),
    },
  },
  {
    type: 'password',
    label: $t('密码'),
    name: 'platformPassword',
    props: {
      placeholder: $t('请输入密码'),
    },
  },
  {
    type: 'text',
    label: '2FA',
    name: 'platformEfa',
    props: {
      placeholder: $t('请输入 2FA 密钥'),
    },
  },
  // {
  //   type: 'text',
  //   label: $t('关联邮箱'),
  //   name: 'platformEmail',
  //   props: {
  //     placeholder: $t('请输入关联邮箱'),
  //   },
  // },
]

watch(() => themeStore.realTheme, () => {
  formRef.value?.setInputsProps({
    platformUrl: {
      options: platformRow.value.map(item => ({
        image: themeStore.realTheme === 'dark' ? item.platformIconDark : item.platformIcon,
        platformIconDark: item.platformIconDark,
        platformIcon: item.platformIcon,
        label: item.platformUrl,
        value: item.platformUrl,
      })),
    },
  })
})

onMounted(async () => {
  setFormValues(activeBar.value)
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
  platformRow.value = rows
  formRef.value?.setInputsProps({
    platformUrl: {
      options: rows.map(item => ({
        image: themeStore.realTheme === 'dark' ? item.platformIconDark : item.platformIcon,
        platformIconDark: item.platformIconDark,
        platformIcon: item.platformIcon,
        label: item.platformUrl,
        value: item.platformUrl,
      })),
    },
  })
})

function setFormValues(data: any = {}) {
  const values = Object.fromEntries(inputs.map(item => [item.name, data[item.name]]))
  formRef.value?.setValues(values)
}

function setOriginValues() {
  if (!formRef.value?.instance.states) {
    return
  }

  const map = Object.entries(formRef.value?.instance.states).map(([name, item]: any) => {
    return [name, item.value]
  })
  if (map.some(([_, value]) => !!value)) {
    map.forEach(([key, value]) => {
      if (key === 'platformUrl') {
        Reflect.set(activeBar.value, 'invalid', !value)
      }
      Reflect.set(activeBar.value, key, value)
    })
  }
}

function switchPlatform(data: any) {
  setOriginValues()
  activeBar.value = data
  setFormValues(data)
}

function createTempId() {
  return `${Date.now().toString(32)}${Math.random().toString(16).slice(2, 8)}`
}

function addPlatform() {
  // 表单是单例：切到新空账号前必须把当前填写写回列表，否则连续添加只会留下最后一条
  setOriginValues()
  const empty = { ...Object.fromEntries(inputs.map(item => [item.name, ''])), tid: createTempId(), invalid: false }
  _datalist.value.push(empty)
  activeBar.value = _datalist.value[_datalist.value.length - 1]!
  formRef.value?.reset()
}

function removePlatform() {
  confirm.require({
    header: $t('删除账号'),
    message: $t('您确认要删除该账号吗？'),
    rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
    acceptProps: { label: $t('确认'), severity: 'danger' },
    accept: () => {
      if (!_datalist.value.length) {
        return
      }
      if (activeBar.value.id) {
        platformUrlIds.value.push(activeBar.value.id)
      }
      const index = _datalist.value.findIndex(item => item.tid === activeBar.value.tid)
      _datalist.value.splice(index, 1)
      activeBar.value = _datalist.value[Math.max(index - 1, 0)] || {}
      setFormValues(activeBar.value)
    },
  })
}

function onConfirm() {
  setOriginValues()// 防止用户新增填写后直接点击保存
  const data = _datalist.value.find(item => item.invalid)
  if (data) {
    switchPlatform(data)
    formRef.value?.submit()// 此处仅仅用于触发校验提醒
    return
  }
  const windowPlatformList = _datalist.value.reduce((acc, item) => {
    const { tid, invalid, platformUrl, ...rest } = item
    if (invalid || !platformUrl) {
      return acc
    }
    // 修改过的账号库账号需要取消关联
    if (rest.id && !isEqual(rawRelatedMap[rest.id], item)) {
      const { id, ...data } = rest
      acc.push({ _tempId: tid, platformUrl, ...data })
      platformUrlIds.value.push(id)
    }
    else {
      acc.push({ platformUrl, ...rest })
    }
    return acc
  }, [])

  emit('confirm', {
    windowPlatformList,
    platformUrlIds: platformUrlIds.value,
  })
}
</script>

<template>
  <div class="flex flex-col h-full content">
    <div class="flex flex-1 overflow-y-auto">
      <div class="flex flex-col select-none sidebar">
        <div v-for="item in _datalist" :key="item.tid" class="relative flex items-center justify-center sidebar-item" :class="{ active: activeBar.tid === item.tid }" @click="switchPlatform(item)">
          <PlatformIcon v-if="item.platformIcon" :platform-icon-dark="item.platformIconDark" :platform-icon="item.platformIcon" class="sidebar-item-icon" />
          <!-- <img v-if="item.platformIcon" class="sidebar-item-icon" :src="item.platformIcon" /> -->
          <SvgIcon v-else name="base/rx_ic_user_key" size="24" />
          <SvgIcon v-if="item.invalid" class="absolute top-2 right-4" name="base/rx_ic_warn_fill" color="var(--colors-icon-icon-error, #F53838)" />
        </div>
        <div class="flex-1 flex justify-center sidebar-item">
          <div v-tooltip="$t('添加新账号')" class="flex justify-center items-center sidebar-add" @click="addPlatform">
            <SvgIcon name="base/rx_ic_plus" />
          </div>
        </div>
      </div>
      <div v-if="_datalist.length > 0" class="flex flex-col flex-1 py-4 px-6 gap-6">
        <div class="flex items-center justify-between">
          <div class="subtitle">
            {{ $t('编辑账号') }}
          </div>
          <div class="flex items-center justify-end gap-1 select-none cursor-pointer remove" @click="removePlatform">
            <SvgIcon name="base/rx_ic_bin_1" />
            <span>{{ $t('移除') }}</span>
          </div>
        </div>
        <TsForm ref="account" :inputs="inputs" />
      </div>
    </div>
    <div class="flex items-end">
      <div class="w-full flex justify-end gap-3 button-group">
        <RxButton size="sm" :label="$t('保存')" @click="onConfirm" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  width: 424px;
}

.subtitle {
  color: var(--colors-text-text-primary, #111213);
  font-size: 14px;
  font-weight: 600;
}

.sidebar {
  width: 70px;
  background: var(--pattern-drawer-bg, #f5fbff);
  overflow-y: auto;

  &::-webkit-scrollbar {
    display: none;
  }

  &-item {
    padding: 16px;
    cursor: pointer;
    border-top: 1px solid transparent;
    border-bottom: 1px solid transparent;
    border-right: 1px solid var(--pattern-drawer-border, #c7d1d6);

    &:first-of-type {
      border-top-color: transparent !important;
    }

    &.active {
      border-top-color: var(--pattern-drawer-border, #c7d1d6);
      border-bottom-color: var(--pattern-drawer-border, #c7d1d6);
      border-right-color: transparent;
      background: var(--colors-background-bg-page, #fff);
    }

    &-icon {
      display: block;
      width: 24px;
      aspect-ratio: 1;
    }
  }

  &-add {
    width: 28px;
    height: 28px;
    padding: 6px;
    border-radius: 8px;
    background: var(--pattern-drawer-bg-create-btn, rgba(0, 0, 0, 0.1));

    &:hover {
      background: var(--pattern-drawer-bg-create-btn-active, #11a3fd);
      color: #fff;
    }
  }
}

.remove {
  color: var(--colors-text-text-primary, #111213);
  font-size: var(--Font-Size-text-sm, 12px);
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.button-group {
  border-top: 1px solid var(--colors-border-border-subtle, #c7d1d6);
  padding: 16px 16px 20px;
}
</style>
