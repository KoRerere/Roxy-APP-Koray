<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'
import { getImage } from '/@/utils'
import { useProxyDetectFailGuide } from '/@/views/agent/shop/hooks/useProxyDetectFailGuide'

/**
 * toast 内购买条（Figma 9707:181132）。
 * 不用创建页大横幅：那条在 360px toast 里会被挤没，且渐变写在 z-index:-1 上会衬到弹窗白底后面。
 */
const emit = defineEmits<{
  buy: []
}>()

const simpleLocale = useSimpleLocale()
const { onAdClick } = useProxyDetectFailGuide()
/** 装饰图是透明底细线，用 img 铺在渐变右侧，保持 PNG 原有透明度 */
const bgUrl = getImage('proxy/proxy_advertise2.png')

function onBuy() {
  onAdClick(() => emit('buy'))
}
</script>

<template>
  <div
    class="toast-roxy-ad relative flex items-center gap-2.5 w-full px-3 py-2.5 overflow-hidden rounded-1 cursor-pointer"
    @click.stop="onBuy"
  >
    <img class="toast-roxy-ad__bg" :src="bgUrl" alt="">
    <div class="relative flex flex-1 flex-col gap-1 min-w-0">
      <span class="toast-roxy-ad__title">{{ $t('第三方代理 IP 质量难保障？') }}</span>
      <span class="toast-roxy-ad__subtitle lang-en:text-2.88">{{ $t('RoxyIP ｜原生适配，稳定实惠') }}</span>
    </div>
    <RxButton
      class="shrink-0 toast-roxy-ad__btn"
      size="xs"
      icon="base/rx_ic_cart"
      :label="simpleLocale.currentLocale === 'ru' ? $t('购买') : $t('立即购买')"
      @click.stop="onBuy"
    />
  </div>
</template>

<style lang="scss" scoped>
.toast-roxy-ad {
  // 渐变画在自身上，避免 z-index:-1 穿出 toast 叠到白底下面
  background:
    linear-gradient(110deg, #3990f8 1.4%, #13dd8d 99.64%), linear-gradient(74deg, #03c1d9 0%, #57da48 107.49%);

  &__bg {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: auto;
    max-width: 219px;
    object-fit: contain;
    object-position: right center;
    pointer-events: none;
  }

  &__title,
  &__subtitle {
    color: #fff;
    font-family: 'DingTalk JinBuTi', sans-serif;
  }

  // toast .alert-message 会继承 12px/18px，标题需单独盖掉才能对齐稿面 15px
  &__title {
    font-size: 15px;
    line-height: normal;
    word-break: break-word;
  }

  // 副标题稿面 nowrap；英文过长时省略，避免把购买按钮挤出 toast
  &__subtitle {
    overflow: hidden;
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__btn {
    border: none;
    position: relative;
    background: var(--colors-background-bg-action, #fff) !important;
    color: var(--colors-text-text-primary, #111213) !important;
    box-shadow:
      0 4px 4px -1px rgba(0, 0, 0, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.06);

    &:hover {
      border: none !important;
    }
  }
}
</style>
