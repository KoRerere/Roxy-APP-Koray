<script setup lang="ts">
import { API } from '/@/api'
import { copyText } from '/@/utils/basic'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'

defineEmits<{
  (e: 'close'): void
}>()

const { isZh } = storeToRefs(useSimpleLocale())
const [showToast, onlyErrorToast] = useResponseToast()

const featureList = [
  $t('选品 / 开店 / 过审 全流程指导'),
  $t('独家选品工具与爆款数据包'),
  $t('卖家社群答疑，避开新手踩坑'),
  $t('设备 + 账号一站式代配置'),
]

const qrcode = ref()

const data = computed(() => {
  const img = isZh.value ? qrcode.value?.wechatQrCode : qrcode.value?.tgQrCode
  const name = isZh.value ? qrcode.value?.wechatName : qrcode.value?.tgName
  const label = isZh.value ? $t('复制客服微信号') : $t('复制客服TG号')
  return { img, name, label }
})

onBeforeMount(() => {
  getQrcode()
})

async function getQrcode() {
  const { code, data, msg } = await API.base.getTgWechatQrcodeList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  qrcode.value = data
}

function onCopyWechatId() {
  if (!data.value.name)
    return
  copyText(data.value.name)
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <div class="w-140 rounded-2 overflow-hidden">
    <div class="relative flex flex-col items-start pa-6 pr-16 gap-2 overflow-hidden header">
      <SvgIcon class="absolute top-6 right-6 cursor-pointer" name="base/rx_ic_delete" color="#ffffff" size="20" @click="$emit('close')" />
      <div class="inline-flex h-4.5 items-center px-2 text-3 font-[DingTalk_JinBuTi] text-white leading-normal rounded-full bg-orange-400">
        {{ $t('Roxy 跨境生态 - 服务商') }}
      </div>
      <div class="text-6 font-[DingTalk_JinBuTi] text-white leading-normal">
        {{ $t('0 基础也能开店 · 顾问 1 对 1 免费陪跑') }}
      </div>
      <div class="max-w-140 text-3 text-white leading-normal">
        {{ $t('还没有账号、不知道怎么起步？添加专属顾问，领取《新手开店全流程指南》并加入卖家交流社群。') }}
      </div>
    </div>

    <div class="flex py-5 px-6 gap-6">
      <div class="flex flex-shrink-0 flex-col items-center gap-2">
        <div class="h-40 w-40 pa-2 rounded-3 bg-white image">
          <img v-if="data.img" class="w-full h-full rounded-2" :src="data.img">
        </div>
        <div class="text-center tt-tertiary text-3 leading-normal">
          {{ $t('微信扫码 · 添加顾问') }}
        </div>
      </div>
      <RxDivider class="!h-auto" vertical line-only line-style="dashed" line-color="var(--colors-border-border-subtle)" />
      <div class="min-w-0 flex flex-1 flex-col justify-center gap-6">
        <div class="flex flex-col gap-3">
          <div v-for="item in featureList" :key="item" class="flex items-start gap-1.5 ">
            <SvgIcon class="mt-0.5 shrink-0 text-#1cc94d" name="base/rx_ic_check_fill" size="16" />
            <span class="tt-primary text-3.25 leading-normal">{{ item }}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <RxButton size="md" icon="base/rx_ic_copy" :label="data.label" @click="onCopyWechatId" />
          <span class="tt-primary text-3 font-500 leading-normal">{{ data.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  background: linear-gradient(
    114deg,
    var(--pattern-E-Commerce-bg-gradient-01, #11a3fd) 16.26%,
    var(--pattern-E-Commerce-bg-gradient-02, #6dc7ff) 70.53%
  );

  &::after {
    position: absolute;
    border-radius: 50%;
    content: '';
    pointer-events: none;
    bottom: -96px;
    left: -32px;
    width: 180px;
    height: 180px;
    background: rgba(255, 255, 255, 0.08);
  }
}

.image {
  border: 1px solid var(--colors-border-border-subtle);
}
</style>
