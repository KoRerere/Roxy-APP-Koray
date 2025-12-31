<script setup lang="ts">
import { API } from '/@/api';
import { RxSvgIcon } from '/@/components/rx-icon';
;
import { useUserStore } from '/@/stores/user';
import { emitter } from '/@/utils/eventBus';
import { getAdvancedFeature } from '/@/constants/advanced-feature';

const props = defineProps<{
  hideFn: () => void,
}>()

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const features = getAdvancedFeature()

const featureTexts = computed(() => [
  features.slice(0, 4),
  features.slice(4),
])

function onRenewal() {
  if (userPayInfo.value.isAuto) {
    router.replace({ name: 'wallet', query: { name: 'billing' } })
  } else {
    emitter.emit('showRenewalDialog')
  }
  hideDialog()
}

function hideDialog() {
  props.hideFn()
  if (userPayInfo.value.showSubExpiredDlg) {
    API.pay.userUpdatePayTipsList({
      source: 'Expired'
    })
  }
}
</script>

<template>
  <div class="subscription-expired">
    <div class="subscription-expired-title">{{ $t('您的订阅已到期，将无法继续使用以下高级功能：') }}</div>
    <div class="flex gap-20">
      <div class="subscription-expired-list" v-for="(list, idx) in featureTexts" :key="idx">
        <div v-for="text in list">
          <div class="subscription-expired-item">
            <RxSvgIcon name="base/rx_ic_delete" />
            <div>{{ text }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="subscription-expired-description">
      {{ $t('立即续订，即可恢复所有会员权益') }}
    </div>
    <div class="subscription-expired-btn-group">
      <RxButton severity="secondary" outlined :label="$t('取消')" class="flex-1" @click="hideDialog"> </RxButton>
      <div class="flex-1 renew-btn-group">
        <RxButton class="w-full" :label="$t('续费套餐')" @click="onRenewal"> </RxButton>
        <!-- <div class="renew-btn-badge-text">
          discount end in 00:29:23
        </div> -->
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.subscription-expired {
  display: flex;
  width: 509px;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;

  .subscription-expired-title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: 20px;
  }

  .subscription-expired-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 9px;

    .subscription-expired-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;
      color: var(--primitives-red-500, #F53838);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: 20px;
    }
  }

  .subscription-expired-description {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: 20px;
  }

  .subscription-expired-btn-group {
    width: 100%;
    display: flex;
    gap: 12px;

    .renew-btn-group {
      position: relative;
    }

    .renew-btn-badge {
      display: flex;
      padding: 4px 12px;
      justify-content: center;
      align-items: center;
      gap: 10px;
      position: absolute;
      right: 17.5px;
      top: -12px;
      border-radius: var(--radius-full, 9999px);
      background: #FC9D12;
      color: #FFF;
      font-family: "DingTalk Sans";
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: normal;
    }

    .renew-btn-badge-text {
      position: absolute;
      top: 40px;
      right: 50%;
      transform: translateX(50%);
      color: var(--colors-text-text-secondary, #B2B6B8);
      text-align: center;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: normal;
      white-space: nowrap;
      pointer-events: none;
    }
  }
}
</style>
