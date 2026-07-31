<script setup lang="tsx">
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import TsFormInputNumber from '/@/views/lab/components/form/m-input-number.vue'
import TsFormInputTextarea from '/@/views/lab/components/form/m-input-textarea.vue'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import { createProfileEntityLabels, useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useRouteContext } from '/@/composables/useRouteContext'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { isEmptyValue, validateURL } from '/@/utils'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'

const { data, onConfirm } = defineProps<{
  data: any[]
  onConfirm: (params: any) => Promise<void>
}>()

defineEmits(['close'])

const [_, onlyErrorToast] = useResponseToast()
const profileLabels = useProfileEntityLabels()

const panel = useCssModule('panel')

const showMore = ref(false)

function createList(labels: ReturnType<typeof createProfileEntityLabels>) {
  return [
  {
    id: 1,
    items: [
      {
        label: $t('编号'),
        class: '!self-start pt-1',
        component: () => {
          return (
            <div class="flex items-end gap-3 flex-wrap overflow-hidden">
              {
                data.map(item => <div class={`shrink-0 py-1 px-1.5 rounded-1 ${panel.tag}`}>{`${getWorkspaceNamePrefix(item.workspaceName)}-${item.windowSortNum}`}</div>)
              }
            </div>
          )
        },
      },
      {
        label: $t('目标网站'),
        name: 'cookieRobotUrls',
        class: '!self-start pt-1',
        props: {
          size: 'md',
          rows: 6,
          placeholder: `${$t('示例')}:\nhttps://www.google.com\nhttps://facebook.com`,
        },
        component: ({ item, ...props }: { item: any, props: any }) => {
          return (
            <div class="self-stretch flex flex-col gap-2">
              <TsFormInputTextarea {...item.props} {...props}></TsFormInputTextarea>
              <div class={panel.description}>
                <div>{$t('1、请输入完整的网址, 需要包括 https:// 或 http://')}</div>
                <div>{$t('2、如需要打开多个网址, 请按每行一个特定的网址的格式填写')}</div>
              </div>
            </div>
          )
        },
      },
    ],
  },
  {
    id: 2,
    subtitle: $t('滚动速度'),
    items: [
      {
        label: $t('单次滚动范围'),
        name: 'scrollRange',
        value: [],
        component: ({ item }: { item: any }) => {
          return (
            <div class="flex items-center gap-3">
              <IconField class="w-30">
                <TsFormInputNumber v-model={item.value[0]} min={100} placeholder="100" />
                <InputIcon class="tip-text">px</InputIcon>
              </IconField>
              <div>~</div>
              <IconField class="w-30">
                <TsFormInputNumber v-model={item.value[1]} min={100} placeholder="500" />
                <InputIcon class="tip-text">px</InputIcon>
              </IconField>
            </div>
          )
        },
      },
      {
        label: $t('停留时长'),
        name: 'delayRange',
        value: [],
        component: ({ item }: { item: any }) => {
          return (
            <div class="flex items-center gap-3">
              <IconField class="w-30">
                <TsFormInputNumber v-model={item.value[0]} min={0} placeholder="0" />
                <InputIcon class="tip-text">ms</InputIcon>
              </IconField>
              <div>~</div>
              <IconField class="w-30">
                <TsFormInputNumber v-model={item.value[1]} min={0} placeholder="500" />
                <InputIcon class="tip-text">ms</InputIcon>
              </IconField>
            </div>
          )
        },
      },
    ],
  },
  {
    id: 3,
    subtitle: $t('更多设置'),
    items: [
      {
        label: $t('不加载图片'),
        name: 'forbidImage',
        value: true,
        props: {
          trueValue: false,
          falseValue: true,
        },
        component: ({ item, ...props }: { item: any, props: any }) => {
          return (
            <div class="flex items-center gap-3">
              <RxToggleSwitch
                {...item.props}
                {...props}
              />
              <div>{$t('开启')}</div>
            </div>
          )
        },
      },
      {
        label: $t('不加载视频'),
        name: 'forbidMedia',
        value: true,
        props: {
          trueValue: false,
          falseValue: true,
        },
        component: ({ item, ...props }: { item: any, props: any }) => {
          return (
            <div class="flex items-center gap-3">
              <RxToggleSwitch
                {...item.props}
                {...props}
              />
              <div>{$t('开启')}</div>
            </div>
          )
        },
      },
      {
        label: labels.closeEntity,
        name: 'closeProfile',
        value: false,
        component: ({ item, ...props }: { item: any, props: any }) => {
          return (
            <div class="flex items-center gap-3">
              <RxToggleSwitch
                {...item.props}
                {...props}
              />
              <div>{labels.closeEntityAfterComplete}</div>
            </div>
          )
        },
      },
      {
        label: $t('无头模式'),
        name: 'startupParam',
        value: false,
        props: {
          trueValue: '--headless=new',
          falseValue: '',
        },
        component: ({ item, ...props }: { item: any, props: any }) => {
          return (
            <div class="flex items-center gap-3">
              <RxToggleSwitch
                {...item.props}
                {...props}
              />
              <div>{$t('开启后不显示浏览器界面，后台自动操作网页')}</div>
            </div>
          )
        },
      },
    ],
  },
  ]
}

const { isEcommerce } = useRouteContext()
const list = ref(createList(createProfileEntityLabels(isEcommerce.value)))

watch(isEcommerce, (value) => {
  const currentValues = Object.fromEntries(list.value.flatMap(item => item.items).filter(item => !!item.name).map(item => [item.name, toRaw(item.value)]))
  list.value = createList(createProfileEntityLabels(value))
  list.value.flatMap(item => item.items).filter(item => !!item.name).forEach((item) => {
    if (currentValues[item.name] !== undefined)
      item.value = currentValues[item.name]
  })
})

const configs = computed(() => {
  return showMore.value ? list.value : list.value.slice(0, 1)
})

async function genCookieRobot() {
  const data = Object.fromEntries(list.value.flatMap(item => item.items).filter(item => !!item.name).map(item => [item.name, toRaw(item.value)]))

  const { delayRange, scrollRange, closeProfile, cookieRobotUrls, ...params } = data

  if (isEmptyValue(data.cookieRobotUrls) || cookieRobotUrls.split('\n').some((url: string) => !validateURL(url))) {
    onlyErrorToast(-1, $t('请输入正确的网址'))
    return
  }

  await onConfirm({
    customParams: {
      $keepOriginOpenUrl: true,
      openWorkbench: 0,
      ...params,
    },
    robotParams: {
      cookieRobotUrls: cookieRobotUrls.split('\n'),
      delayRange: isEmptyValue(delayRange) ? undefined : delayRange,
      scrollRange: isEmptyValue(scrollRange) ? undefined : scrollRange,
      closeProfile,
    },
  })
}
</script>

<template>
  <div class="relative w-140 flex flex-col gap-5 pa-6 rounded-2 overflow-hidden overflow-y-auto popup">
    <div class="flex flex-col gap-1 pb-2">
      <div class="flex justify-between items-center">
        <div class="title">
          {{ $t('Cookie 机器人') }} 🤖
        </div>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" @click="$emit('close')" />
      </div>
      <div class="desc">
        {{ profileLabels.cookieRobotHelp }}
      </div>
    </div>
    <div class="grid gap-4 items-center list">
      <template v-for="item in configs" :key="item.id">
        <div v-if="item.subtitle" class="subtitle">
          {{ item.subtitle }}
        </div>
        <template v-for="subItem in item.items" :key="subItem.label">
          <div class="text" :class="subItem.class">
            {{ subItem.label }}
          </div>
          <component :is="subItem.component" v-if="subItem.component" v-model="subItem.value" :item="subItem" class="text" />
        </template>
      </template>
    </div>
    <div v-if="!showMore" class="flex items-center justify-center gap-1 cursor-pointer" @click="showMore = true">
      <div class="more">
        {{ $t('更多设置') }}
      </div>
      <SvgIcon name="base/rx_ic_chevron_down" />
    </div>
    <RxButton class="shrink-0" size="lg" :label="$t('开始生成 Cookie')" @click="genCookieRobot" />
  </div>
</template>

<style module="panel">
.tag {
  border: 0.5px solid var(--component-tag-border);
  background: var(--component-tag-bg);
  color: var(--component-tag-text);
  font-size: 12px;
  font-family: 'JetBrains Mono';
  font-weight: 500;
  line-height: 16px;
}

.description {
  color: var(--colors-text-text-placeholder);
  font-size: 12px;
  line-height: 18px;
}
</style>

<style lang="scss" scoped>
.list {
  grid-template-columns: max-content 1fr;
}

.subtitle {
  grid-column: 1 / -1;
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.popup {
  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  &::before {
    background-image: url('/images/cookie-robot-bg.svg');
    background-size: 100% auto;
    background-repeat: no-repeat;
    background-position: 0 0;
    z-index: -1;
  }

  &::after {
    background:
      linear-gradient(180deg, rgba(17, 163, 253, 0.2) 0%, rgba(17, 163, 253, 0) 20%), var(--colors-background-bg-page);
    border-radius: 8px;
    z-index: -2;
  }
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.desc {
  color: var(--colors-text-text-placeholder);
  font-size: 13px;
  line-height: 20px;
}

.more {
  color: var(--colors-text-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.text {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 1;
}
</style>
