<script lang="ts" setup>
import TsForm from '/@/views/lab/components/form/index.vue';
import { API } from '/@/api'
import { $t } from '/@/locales'
import { deepClone, validateURL } from '/@/utils'
import { isEqual } from 'es-toolkit';
import { useConfirm } from 'primevue/useconfirm'

interface Props {
  datas?: Record<string, any>[]
}

const { datas = [] } = defineProps<Props>()

const emit = defineEmits(['confirm'])
const confirm = useConfirm()

const _datalist = ref<Record<string, any>[]>(datas.map((item, index) => ({ ...item, tid: (Date.now() + index ** 2).toString(32), invalid: false })))
const rawRelatedMap = Object.fromEntries(_datalist.value.filter(item => !!item.id).map(item => [item.id, deepClone(item)]))
const activeBar = ref(_datalist.value[0])
const platformUrlIds = ref<any[]>([])// 需要解绑的账号库账号 ids

const formRef = useTemplateRef<any>('account')

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
        const platformIcon = props.options.find((item: any) => item.value === value)?.image ?? ''
        Reflect.set(activeBar.value, 'platformIcon', platformIcon)
        Reflect.set(activeBar.value, 'invalid', !value)
      }
    },
    resolver: (zod: any) => zod.string().refine(validateURL, $t('请输入正确的平台网址'))
  },
  {
    type: 'text',
    label: $t('账号'),
    name: 'platformUserName',
    props: {
      placeholder: $t('请输入账号'),
    }
  },
  {
    type: 'password',
    label: $t('密码'),
    name: 'platformPassword',
    props: {
      placeholder: $t('请输入密码'),
    }
  },
  {
    type: 'text',
    label: '2FA',
    name: 'platformEfa',
    props: {
      placeholder: $t('请输入 2FA 密钥'),
    }
  }
]

onMounted(() => {
  setFormValues(activeBar.value)
})

function setFormValues(data: any = {}) {
  const values = Object.fromEntries(inputs.map(item => [item.name, data[item.name]]))
  formRef.value?.setValues(values)
}

function setOriginValues() {
  if (!formRef.value?.instance.states) return

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

function addPlatform() {
  const empty = { ...Object.fromEntries(inputs.map(item => [item.name, ''])), tid: Date.now().toString(32), invalid: false }
  _datalist.value.push(empty)
  activeBar.value = empty
  formRef.value?.reset()
}

function removePlatform() {
  confirm.require({
    header: $t('删除账号'),
    message: $t('您确认要删除该账号吗？'),
    rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
    acceptProps: { label: $t('确认'), severity: 'danger' },
    accept: () => {
      if (!_datalist.value.length) return
      if (activeBar.value.id) platformUrlIds.value.push(activeBar.value.id)
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
    formRef.value?.submit()//此处仅仅用于触发校验提醒
    return
  }
  const windowPlatformList = _datalist.value.reduce((acc, item) => {
    const { tid, invalid, platformUrl, ...rest } = item
    if (invalid || !platformUrl) return acc
    // 修改过的账号库账号需要取消关联
    if (rest.id && !isEqual(rawRelatedMap[rest.id], item)) {
      const { id, ...data } = rest
      acc.push({ _tempId: tid, platformUrl, ...data })
      platformUrlIds.value.push(id)
    } else {
      acc.push({ platformUrl, ...rest })
    }
    return acc
  }, [])

  emit('confirm', {
    windowPlatformList,
    platformUrlIds: platformUrlIds.value
  })
}

</script>

<template>
  <div class="flex flex-col h-full content">
    <div class="flex flex-1 overflow-y-auto">
      <div class="flex flex-col select-none sidebar">
        <div class="relative flex items-center justify-center sidebar-item" :class="{ 'active': activeBar.tid === item.tid }" v-for="item in _datalist" :key="item.tid" @click="switchPlatform(item)">
          <img v-if="item.platformIcon" class="sidebar-item-icon" :src="item.platformIcon" />
          <SvgIcon v-else name="base/rx_ic_user_key" size="24"></SvgIcon>
          <SvgIcon v-if="item.invalid" class="absolute top-2 right-4" name="base/rx_ic_warn_fill" color="var(--colors-icon-icon-error, #F53838)"></SvgIcon>
        </div>
        <div class="flex-1 flex justify-center sidebar-item">
          <div v-tooltip="$t('添加新账号')" class="flex justify-center items-center sidebar-add" @click="addPlatform">
            <SvgIcon name="base/rx_ic_plus"></SvgIcon>
          </div>
        </div>
      </div>
      <div v-if="_datalist.length > 0" class="flex flex-col flex-1 py-4 px-6 gap-6">
        <div class="flex items-center justify-between">
          <div class="subtitle">{{ $t('编辑账号') }}</div>
          <div class="flex items-center justify-end gap-1 select-none cursor-pointer remove" @click="removePlatform">
            <SvgIcon name="base/rx_ic_bin_1"></SvgIcon>
            <span>{{ $t('移除') }}</span>
          </div>
        </div>
        <TsForm ref="account" :inputs="inputs"></TsForm>
      </div>
    </div>
    <div class="flex items-end">
      <div class="w-full flex justify-end gap-3 button-group">
        <RxButton size="sm" :label="$t('保存')" severity="info" @click="onConfirm" />
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
  background: var(--pattern-drawer-bg, #F5FBFF);
  overflow-y: auto;

  &::-webkit-scrollbar {
    display: none;
  }

  &-item {
    padding: 16px;
    cursor: pointer;
    border-top: 1px solid transparent;
    border-bottom: 1px solid transparent;
    border-right: 1px solid var(--pattern-drawer-border, #C7D1D6);

    &:first-of-type {
      border-top-color: transparent !important;
    }

    &.active {
      border-top-color: var(--pattern-drawer-border, #C7D1D6);
      border-bottom-color: var(--pattern-drawer-border, #C7D1D6);
      border-right-color: transparent;
      background: var(--colors-background-bg-page, #FFF);
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
    background: var(--pattern-drawer-bg-create-btn, rgba(0, 0, 0, 0.10));

    &:hover {
      background: var(--pattern-drawer-bg-create-btn-active, #11A3FD);
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
  border-top: 1px solid var(--colors-border-border-subtle, #C7D1D6);
  padding: 16px 16px 20px;
}
</style>
