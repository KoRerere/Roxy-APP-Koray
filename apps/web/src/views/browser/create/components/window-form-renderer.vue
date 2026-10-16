<script lang="ts" setup>
import InputLabel from '/@/components/ry-form/input-label.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import Position from '/@/views/browser/create/components/position.vue'
import { $t } from '/@/locales/index.js'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText, findInputByName } from '/@/utils/'
import { useSuggestedWindowName } from '../hooks/useSuggestedWindowName'
import AccountItem from './account.vue'
import CookiesItem from './cookies.vue'
import OsSwitch from './os-switch.vue'
import ProxyItem from './proxy.vue'
import UrlsItem from './urls.vue'
import UserAgentField from './user-agent-field.vue'

interface Props {
  inputs?: any[]
  inputsGroup?: any[][]
  variant?: 'window' | 'settings'
  excludedFields?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  inputs: () => [],
  inputsGroup: () => [],
  variant: 'settings',
  excludedFields: () => [],
})

const [showToast] = useResponseToast()

const renderedInputs = computed(() => {
  const filteredInputs = props.inputs.filter((input) => {
    return !props.excludedFields.includes(input.name)
  })

  while (filteredInputs[0]?.separator) {
    filteredInputs.shift()
  }
  while (filteredInputs.at(-1)?.separator) {
    filteredInputs.pop()
  }

  return filteredInputs as never[]
})

const windowNameInput = computed<any>(() => renderedInputs.value.find((input: { name?: string }) => input?.name === 'windowName'))

/** 批量创建名称只回填日期序号，不带平台缩写和代理国家 */
useSuggestedWindowName({
  serialOnly: true,
  enabled: () => Boolean(windowNameInput.value && !windowNameInput.value.dirId),
  getNameInput: () => windowNameInput.value,
  getAccounts: () => [],
  getProxyList: () => [],
})

const cookiePlatformUrls = computed(() => {
  const windowInputs = props.inputsGroup[0] ?? []
  const platformList = findInputByName(windowInputs, 'windowPlatformList')?.value ?? []
  return platformList.map((item: any) => item.platformUrl).filter(Boolean)
})

function onCopy(dirId: string) {
  copyText(dirId)
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <RyForm
    v-if="renderedInputs.length"
    class="min-w-0 w-full max-w-full"
    :class="{ 'profile-info': variant === 'window' }"
    label-position="left"
    :inputs="renderedInputs"
  >
    <template #name="{ input }">
      <div class="flex min-w-0 w-full flex-col gap-2">
        <div v-if="!!input.dirId" class="flex items-center justify-end gap-2.5">
          <span class="text-3 font-[JetBrains_Mono]">ID:{{ input.dirId }}</span>
          <span class="text-3 font-[JetBrains_Mono] color-blue cursor-pointer" @click="onCopy(input.dirId)">{{ $t('复制') }}</span>
        </div>
        <div class="flex min-w-0 w-full items-start">
          <InputLabel class="shrink-0" v-bind="input" />
          <div class="min-w-0 flex-1 flex flex-col gap-1">
            <RxInputText v-model="input.value" class="min-w-0 flex-1" v-bind="input" />
            <span v-if="!input.dirId" class="text-2.75 tt-inactive">{{ $t('* 系统自动生成窗口名称，也可手动修改。') }}</span>
          </div>
        </div>
      </div>
    </template>
    <template #system="{ input }">
      <div class="flex min-w-0 w-full items-center">
        <InputLabel class="shrink-0" v-bind="input" />
        <div class="min-w-0 flex-1 flex gap-2 overflow-hidden">
          <OsSwitch v-model="input.items[0].value" class="min-w-0 flex-1" :options="input.items[0].options" @change="input.items[0].change?.(input.items[0], input.items)">
            <template #item="{ item }">
              <SvgIcon :name="item.icon!" />
            </template>
          </OsSwitch>
          <RxInputSelect v-bind="input.items[1]" v-model="input.items[1].value" class="min-w-0 flex-1" @change="input.items[1].change?.(input.items[1], input.items)" />
        </div>
      </div>
    </template>
    <template #kernel="{ input }">
      <div class="flex min-w-0 w-full items-center">
        <InputLabel class="shrink-0" v-bind="input" />
        <div class="min-w-0 flex-1 flex flex-col gap-2 overflow-hidden">
          <div class="min-w-0 flex flex-1 gap-2 overflow-hidden">
            <OsSwitch
              v-model="input.items[0].value"
              class="min-w-0 flex-1"
              :disabled="input.items[0].disabled"
              :disabled-tooltip="input.items[0].disabled ? $t('内核不支持修改') : undefined"
              :options="input.items[0].options"
              @change="input.items[0].change?.(input.items[0], input.items)"
            >
              <template #item="{ item }">
                <div class="flex items-center gap-1.5">
                  <SvgIcon :name="item.icon!" />
                  <span>{{ item.label }}</span>
                </div>
              </template>
            </OsSwitch>
            <RxInputSelect v-bind="input.items[1]" v-model="input.items[1].value" class="min-w-0 flex-1" @change="input.items[1].change?.(input.items[1], input.items)" />
          </div>
          <Message v-if="input.items[1].help" severity="error" size="small" variant="simple">
            {{ input.items[1].help }}
          </Message>
        </div>
      </div>
    </template>
    <template #userAgent="{ input }">
      <UserAgentField :input="input" :inputs-group="inputsGroup" />
    </template>
    <template #cookies="{ input }">
      <CookiesItem v-model="input.value" v-model:invalid="input.invalid" :platform-urls="cookiePlatformUrls" v-bind="input" />
    </template>
    <template #proxy="{ input }">
      <div class="-mt-5 px-4 py-6 w-full dashed-border">
        <ProxyItem v-model="input.value" v-bind="input" />
      </div>
    </template>
    <template #accounts="{ input }">
      <div class="-mt-5 px-4 py-6 w-full dashed-border">
        <AccountItem v-model="input.value" v-model:type="input.platformBindType" v-bind="input" />
      </div>
    </template>
    <template #urls="{ input }">
      <UrlsItem v-model="input.value" v-model:invalid="input.invalid" v-bind="input" />
    </template>
    <template #windowOpenSize="{ input }">
      <div class="flex">
        <InputLabel v-bind="input" />
        <div class="flex gap-2">
          <InputGroup v-for="(item, idx) in input.items" :key="item.name">
            <InputGroupAddon class="text-3.5">
              {{ idx === 0 ? $t('宽') : $t('高') }}
            </InputGroupAddon>
            <RxInputText v-bind="item" v-model="item.value" class="!w-25" />
          </InputGroup>
        </div>
      </div>
    </template>
    <template #windowRatioPosition="{ input }">
      <div class="flex py-4">
        <InputLabel v-bind="input" />
        <Position v-model="input.value" />
      </div>
    </template>
    <template #forbiddenPictureSize="{ input }">
      <div class="flex">
        <InputLabel v-bind="input" />
        <div>
          <div class="tip-text">
            {{ $t('禁止加载超过以下大小的图片（如果设置为0则不加载任何图片，为避免无法显示验证码，建议填写10KB）') }}
          </div>
          <div class="w-[105px] mt-2">
            <IconField>
              <InputNumber v-model="input.value" input-class="w-full !pr-[28px]" size="small" />
              <InputIcon class="tip-text">
                KB
              </InputIcon>
            </IconField>
          </div>
        </div>
      </div>
    </template>
  </RyForm>
</template>

<style lang="scss" scoped>
:deep(.p-inputgroup) {
  .p-select + .p-select,
  .p-inputtext + .p-inputtext {
    border-left: none;
  }
}

:deep(.rx-label) {
  text-align: right;
  max-width: 100px;
  min-width: 100px !important;
}

.profile-info {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;

  :deep(.separator) {
    border-style: dashed;
  }

  // 自定义 slot 行与 .rx-input 默认行参与父级宽度收缩；左右留白由外层容器负责（手风琴 content / outside 的 px-4）
  :deep(.rx-input),
  > :not(.rx-input):not(.dashed-border) {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  :deep(.rx-input) {
    > .flex-1 {
      min-width: 0;
    }
  }

  :deep(.rx-label) {
    flex-shrink: 0;
    text-align: right;
    min-width: 100px !important;
  }
}

.dashed-border {
  border-bottom: 1px dashed var(--colors-border-divider-dashed);
}

.tip-text {
  color: var(--colors-text-text-tertiary, #575d60);
  font-size: 12px;
  line-height: 16px;
}
</style>
