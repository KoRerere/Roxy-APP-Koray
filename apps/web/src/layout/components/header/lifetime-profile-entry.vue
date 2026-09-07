<script setup lang="ts">
import { h } from 'vue'
import { useDialog } from '/@/hooks/useDialog'
import { usePermission } from '/@/hooks/usePermission'
import { useRouteContext } from '/@/composables/useRouteContext'
import LifetimeProfileModal from '/@/views/pay/wallet/components/lifetime-profile-modal.vue'

const [showModal] = useDialog()
const { check } = usePermission()
const { isEcommerce } = useRouteContext()

/** 电商渠道无此商品；无费用中心权限无法结算，顶栏不展示入口 */
const visible = computed(() => !isEcommerce.value && check('Cost_Center_all'))

/** 打开终身窗口购买弹窗（仅钱包结算），与「我的资源」入口同一套流程 */
function buyLifetimeProfile() {
  showModal({
    header: 'lifetime-profile-purchase',
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(LifetimeProfileModal, {
        onClose: hideModal,
      }),
    },
  })
}
</script>

<template>
  <!-- 圆标压住文案条左侧，与设计稿叠层胶囊一致；分隔线跟入口同显隐，避免电商/无权限时留下空分割 -->
  <div
    v-if="visible"
    class="lifetime-entry isolate flex items-center shrink-0 cursor-pointer select-none"
    @click="buyLifetimeProfile"
  >
    <div class="lifetime-entry__cart relative z-2 -mr-4 flex items-center p-1.5 rounded-[60px]">
      <div class="size-5 overflow-hidden shrink-0">
        <SvgIcon class="size-full" name="base/rx_ic_cart" :size="20" color="#fff" />
      </div>
    </div>
    <div class="lifetime-entry__pill relative z-1 flex items-center gap-1.5 h-7 pl-6 pr-2 overflow-hidden rounded-[6px]">
      <span class="text-[13px] leading-normal text-white whitespace-nowrap font-[DingTalk_JinBuTi]">
        {{ $t('购买终身窗口') }}
      </span>
      <div class="overflow-hidden shrink-0">
        <SvgIcon class="size-full" name="base/rx_ic_arrow_right_2" :size="14" color="#fff" />
      </div>
    </div>
  </div>
  <Divider v-if="visible" class="!ma-0" layout="vertical" />
</template>

<style lang="scss" scoped>
.lifetime-entry {
  &__cart {
    border: 1px solid #fff;
    background: linear-gradient(135deg, #7e61f0 0%, #11a3fd 56.731%, #34d6e8 100%);
    box-shadow:
      0 4px 2px rgba(0, 0, 0, 0.02),
      0 1px 0.5px rgba(0, 0, 0, 0.06);
  }

  &__pill {
    background: linear-gradient(95.69deg, #48abfe 0%, #9f68fa 100%);
  }
}
</style>
