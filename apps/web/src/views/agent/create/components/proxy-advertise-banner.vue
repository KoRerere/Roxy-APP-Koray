<script setup lang="ts">
import { getImage } from '/@/utils'
import { useProxyDetectFailGuide } from '/@/views/agent/shop/hooks/useProxyDetectFailGuide'
import { useProxyCreateLabels } from '../proxy-create-mode'

/** 顶部引导购买 / 测速失败后的底部引导 */
type AdvertiseVariant = 'top' | 'fail'

const { variant = 'top' } = defineProps<{
  /** 不传默认顶部横幅；fail 用于测速失败后的购买引导 */
  variant?: AdvertiseVariant
}>()

const emit = defineEmits<{
  /** 点击「立即购买」，由父级决定聚焦购买区、弹购买菜单或绑定窗口 */
  buy: []
}>()

const { onAdClick } = useProxyDetectFailGuide()

/** 失败广告整区可点；无费用中心权限时不出购买、只出 Tips */
function onFailBuy() {
  onAdClick(() => emit('buy'))
}

const labels = useProxyCreateLabels()
const isDeviceMode = computed(() => labels.value.mode === 'device')
const isFail = computed(() => variant === 'fail')
const rootRef = useTemplateRef<HTMLElement>('root')

/** 背景图随 variant 切换，避免两套组件各绑一张 */
const bgSrc = computed(() => `url('${getImage(isFail.value ? 'proxy/proxy_advertise2.png' : 'proxy/proxy_advertise1.png')}')`)

/** 顶部横幅文案（代理 / 设备） */
const advertiseTop = computed(() => isDeviceMode.value
  ? {
      title: $t('让电商账号从设备开始更稳定'),
      keypath: $t('RoxyIP 原生适配 RoxyBrowser，{light}', { light: '{light}' }),
      highlight: $t('纯净独享，覆盖 100+ 国家'),
    }
  : {
      title: $t('让浏览器环境从代理 IP 开始更稳定'),
      keypath: $t('RoxyIP 原生适配 RoxyBrowser，{light}', { light: '{light}' }),
      highlight: $t('纯净独享，覆盖 100+ 国家'),
    })

/** 测速失败底栏文案（代理 / 设备） */
const advertiseBottom = computed(() => isDeviceMode.value
  ? {
      line1: $t('导入设备不稳定？'),
      line2: $t('RoxyIP 已适配 RoxyBrowser，价格更低，连接更稳定。'),
    }
  : {
      line1: $t('导入代理 IP 不稳定？'),
      line2: $t('RoxyIP 已适配 RoxyBrowser，价格更低，连接更稳定。'),
    })

/** 测速失败后父级需要滚到这条横幅 */
function scrollIntoView(arg?: boolean | ScrollIntoViewOptions) {
  rootRef.value?.scrollIntoView(arg)
}

defineExpose({
  scrollIntoView,
})
</script>

<template>
  <div
    ref="root"
    class="flex items-center pa-3.5 gap-5 shrink-0 rounded-2"
    :class="isFail ? 'advertise-fail cursor-pointer' : 'advertise-top'"
    @click="isFail ? onFailBuy() : undefined"
  >
    <div class="flex-1 flex flex-col gap-0.5">
      <template v-if="isFail">
        <div class="text-3.75 leading-normal color-white font-[DingTalk_JinBuTi]">
          {{ advertiseBottom.line1 }}
        </div>
        <div class="text-3 leading-normal color-white font-[DingTalk_JinBuTi]">
          {{ advertiseBottom.line2 }}
        </div>
      </template>
      <template v-else>
        <div class="text-3.75 leading-normal color-[#111213] font-[DingTalk_JinBuTi]">
          {{ advertiseTop.title }}
        </div>
        <div class="text-3 leading-4 color-[#111213] font-[DingTalk_JinBuTi]">
          <i18n-t tag="span" scope="global" :keypath="advertiseTop.keypath">
            <template #light>
              <span class="text-3.25 color-[#11A3FD]">
                {{ advertiseTop.highlight }}
              </span>
            </template>
          </i18n-t>
        </div>
      </template>
    </div>
    <RxButton
      :severity="isFail ? 'secondary' : undefined"
      icon="base/rx_ic_cart"
      size="xs"
      :label="$t('立即购买')"
      @click.stop="isFail ? onFailBuy() : emit('buy')"
    />
  </div>
</template>

<style lang="scss" scoped>
.advertise-top,
.advertise-fail {
  position: relative;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  &::before {
    background-image: v-bind(bgSrc);
    background-size: auto 100%;
    background-repeat: no-repeat;
    background-position: bottom right;
    z-index: -1;
  }
}

.advertise-top::after {
  z-index: -2;
  background:
    linear-gradient(180deg, rgba(17, 163, 253, 0.2) 0%, rgba(17, 163, 253, 0.08) 100%),
    linear-gradient(0deg, #fff 0%, #fff 100%), linear-gradient(0deg, #bcf257 0%, #bcf257 100%),
    linear-gradient(91deg, #fbecd2 0%, #ead3f5 50%, #dff7f8 100%);
}

.advertise-fail::after {
  z-index: -2;
  background:
    linear-gradient(94deg, #3990f8 -1.41%, #13dd8d 99.64%), linear-gradient(87deg, #03c1d9 0%, #57da48 107.49%);
}
</style>
