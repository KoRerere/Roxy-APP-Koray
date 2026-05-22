<script setup lang="tsx">
import { usePay } from '/@/views/pay/wallet/hook'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils'

interface Props {
  data: Record<string, any>
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

const { data: props, onConfirm, onCancel } = defineProps<Props>()

const emit = defineEmits(['close'])

const { genCheckerOrderStatus } = usePay()
const [showToast, onlyErrorToast] = useResponseToast()
const loading = ref(false)
const checker = genCheckerOrderStatus()

onMounted(() => {
  checkStatus()
  openPayWeb()
})

onBeforeUnmount(() => {
  checker.stop()
})

async function checkStatus(force = false) {
  if (force) {
    checker.stop()
  }

  try {
    const isOK = force ? await checker.checkOnce(props.orderNo) : await checker.check(props.orderNo)
    if (isOK) {
      confirm()
    }
    else if (force) {
      close(true)
    }
  }
  catch (error) {
    close(true)
    onlyErrorToast(-1, (error as Error).message)
  }
}

async function openPayWeb() {
  const { orderNo, payUrl } = props || {}
  if (!orderNo || !payUrl)
    return
  window.open(payUrl)
}

function copyLink() {
  copyText(props.payUrl)
  showToast(0, $t('复制成功'))
}

async function confirm() {
  loading.value = true
  await onConfirm?.()
  loading.value = false
  close(false)
}

function close(isCancel: boolean) {
  emit('close')
  if (isCancel)
    onCancel?.()
}
</script>

<template>
  <div class="flex flex-col pt-12 pb-6 px-6 gap-6 select-none popup">
    <img class="block mx-auto w-8 h-8 loading-circle" src="/@/assets/icons/status/loading.png">
    <div class="flex flex-col">
      <div class="title">
        {{ $t('正在处理支付...') }}
      </div>
      <div class="mt-6 desc">
        {{ $t('请在 30 分钟内完成支付，确认前请保持此窗口开启。') }}
      </div>
      <i18n-t class="mt-2 desc" tag="div" :keypath="$t('若支付页面未加载，请 {link} 并在浏览器中打开。', { link: '{link}' })" scope="global">
        <template #link>
          <span class="cursor-pointer desc-link" @click="copyLink">{{ $t('复制链接') }}</span>
        </template>
      </i18n-t>
    </div>
    <div class="flex flex-col gap-2.5">
      <!-- <RxButton v-model:loading="loading" size="lg" :label="$t('支付成功')" @click="checkStatus(true)" /> -->
      <RxButton size="lg" outlined severity="secondary" :label="$t('取消')" @click="close(true)" />
      <i18n-t class="help" tag="div" :keypath="$t('* 支付遇到问题？ {link}', { link: '{link}' })" scope="global">
        <template #link>
          <span class="cursor-pointer help-link" @click="$showLiveChat">{{ $t('联系我们') }}</span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 380px;
}

.title {
  color: var(--colors-text-text-primary, #fafafa);
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.desc {
  color: var(--colors-text-text-tertiary, #575d60);
  font-size: 14px;
  line-height: 20px;

  &-link {
    color: var(--colors-text-text-brand, #12a3fc);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: auto;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}

.help {
  color: var(--colors-text-text-tertiary, #575d60);
  font-size: 12px;
  line-height: 20px;

  &-link {
    color: var(--colors-text-text-brand, #12a3fc);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: auto;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
