<script lang="tsx" setup>
import { h } from 'vue'
import StepIndicator from './step-indicator.vue'
import ConsultantModal from './consultant-modal.vue'
import TsForm from '/@/views/lab/components/form/index.vue'
import RxTooltip from '/@/components/rx-tooltip'
// import RxCheckbox from '/@/components/rx-checkbox/index.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { API } from '/@/api'
import { useCheckProxy } from '/@/views/agent/hooks'
import { ACCOUNT_PLATFORM_CASCADE_PROPS, ACCOUNT_PLATFORM_ICON_LEVELS, buildDeviceInfoFromProxy, toEcommerceRequestFields, withCascadePlatformImages } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import { BuyProxyListType, ProxyCheckStatus, ProxyOrderStatus, ProxyType } from '/@/enums'
import { getImage } from '/@/utils/basic'
import { useThemeStore } from '/@/stores/theme'
import { useDialog } from '/@/hooks/useDialog'

const { onSuccess } = defineProps<{
  onSuccess: (params: { data: any, checkResult: any }) => void | Promise<void>
}>()

const { testProxy } = useCheckProxy()
const { isDarkTheme } = storeToRefs(useThemeStore())
const [showModal] = useDialog()

const formRef = useTemplateRef('tsform')

const platformOptions = ref<unknown[]>([])
const loading = ref(false)
const proxyInfo = ref()

const bgImageUrl = computed(() => (
  isDarkTheme.value
    ? getImage('ecommerce/modal_bg_dark.svg')
    : getImage('ecommerce/modal_bg_light.svg')
))

const inputs = [
  {
    type: 'cascade',
    label: $t('电商平台'),
    name: 'accountPlatform',
    required: true,
    props: {
      options: [],
      ...ACCOUNT_PLATFORM_CASCADE_PROPS,
      size: 'lg',
      placeholder: $t('选择或搜索平台（亚马逊/ TikTok Shop/eBay...）'),
      darkMode: isDarkTheme.value,
    },
  },
  {
    type: 'text',
    label: $t('账号名称'),
    name: 'windowName',
    required: true,
    props: {
      placeholder: $t('请输入账号备注名称，便于区分不同账号'),
      size: 'lg',
    },
  },
  {
    type: 'text',
    label: $t('登录账号'),
    name: 'platformUserName',
    props: {
      placeholder: $t('请输入平台登录账号'),
      size: 'lg',
    },
    labelRender: () => {
      // const checked = ref(false)
      return (
        <div class="flex items-center justify-between tt-primary   select-none">
          <div class="flex items-center gap-1">
            <div class="text-3.5 leading-4">{$t('登陆账号')}</div>
            <RxTooltip class="flex items-center cursor-pointer">
              {{
                default: () => <RxSvgIcon name="base/rx_ic_question" color="var(--colors-icon-icon-note)" size="14"></RxSvgIcon>,
                content: () => <div class="text-3 color-white">{$t('填写您账号所在平台的登录账号密码，我们会为您加密保存，并在您登录时自动填充。')}</div>,
              }}
            </RxTooltip>
          </div>
          {/* <label class="flex items-center gap-1">
            <RxCheckbox v-model={checked.value} binary></RxCheckbox>
            <div class="text-3.25 leading-4">{$t('登陆账号')}</div>
            <RxSvgIcon name="base/rx_ic_question" color="var(--colors-icon-icon-note)" size="12"></RxSvgIcon>
          </label> */}
        </div>
      )
    },
    afterRender: () => {
      return (
        <div class="mt-1 flex items-center gap-1 text-3.25 leading-4">
          <div class="tt-primary">{$t('还没有账号?')}</div>
          <div class="tt-brand underline underline-from-font cursor-pointer" onClick={openConsultantModal}>{$t('免费咨询顾问')}</div>
        </div>
      )
    },
  },
  {
    type: 'password',
    label: $t('登录密码'),
    name: 'platformPassword',
    props: {
      placeholder: $t('请输入平台登录密码'),
      size: 'lg',
    },
  },
]

onMounted(() => {
  getPlatformOptions()
})

watch(isDarkTheme, (dark) => {
  formRef.value?.setInputsProps({
    accountPlatform: {
      darkMode: dark,
    },
  })
})

function openConsultantModal() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(ConsultantModal, {
        onClose: hideModal,
      }),
    },
  })
}

async function getPlatformOptions() {
  const { data } = await API.platform.userGetPlatformUrlTreeList()
  // 仅平台列映射图标，与电商账号基础信息表单一致
  platformOptions.value = withCascadePlatformImages(data ?? [], ACCOUNT_PLATFORM_ICON_LEVELS)
  formRef.value?.setInputsProps({
    accountPlatform: {
      options: platformOptions.value,
      darkMode: isDarkTheme.value,
    },
  })
}

async function getDeviceInfo() {
  const { code, data } = await API.proxy.userGetProxyListMergedList({ type: BuyProxyListType.List })
  if (code !== 0)
    return
  proxyInfo.value = data.rows[0]
}

async function onFormSubmit({ intelligent: _, platformUserName, platformPassword, accountPlatform, windowName, ...values }: Record<string, any>) {
  loading.value = true
  await getDeviceInfo()

  const checkResult = await testProxy({ ...toRaw(proxyInfo.value), apiCheck: false })
  const proxy = { ...toRaw(proxyInfo.value), ...checkResult }
  const proxyInfoList = checkResult.checkStatus !== ProxyCheckStatus.success && proxy.buyProxyType === ProxyType.buy && proxy.orderStatus === ProxyOrderStatus.pending
    ? []
    : [proxy]
  // 必须传入平台树：displayPlatform 依赖 options 拼级联路径文案
  const data = toEcommerceRequestFields({
    accountPlatform,
    windowName: windowName?.trim(),
    platformUserName: platformUserName?.trim(),
    platformPassword: platformPassword?.trim(),
    proxyInfoList,
    deviceInfo: buildDeviceInfoFromProxy(proxy),
    ...values,
  }, platformOptions.value)
  onSuccess({ data, checkResult })

  loading.value = false
}
</script>

<template>
  <div class="w-full h-full flex flex-col pt-30 pb-10 items-center gap-8">
    <StepIndicator :current="1" />
    <div class="overflow-hidden relative w-165 flex flex-col gap-12 py-12 rounded-3 platform">
      <img class="platform__bg" :src="bgImageUrl" alt="" aria-hidden="true">
      <div class="px-10 flex-1 overflow-y-auto">
        <TsForm id="platform" ref="tsform" class="relative z-1 gap-5" :validate-on-value-update="false" validate-on-blur :inputs="inputs" @submit="onFormSubmit" />
      </div>
      <div class="px-10 relative z-1 w-90 mx-auto">
        <RxButton class="w-full" size="lg" :loading="loading" :label="$t('确认添加')" form="platform" type="submit" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scrollbar::-webkit-scrollbar {
  display: none;
}

.platform {
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background-color: var(--colors-background-bg-overlay);

  &__bg {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }
}

:deep(.item) {
  gap: 8px;
}

:deep(.label) {
  font-size: 14px;
  font-weight: 400;
  line-height: 16px;
}
</style>
