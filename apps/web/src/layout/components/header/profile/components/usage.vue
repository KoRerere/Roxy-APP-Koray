<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon';
import { useUserStore } from '/@/stores/user';
import LiveChat from '/@/components/business/live-chat/index.vue'

const { userInfo } = storeToRefs(useUserStore())

const percent = computed(() => {
  const { useWindowCount, maxWindowCount } = userInfo.value
  return Math.ceil((useWindowCount / maxWindowCount) * 10)
})

const alpha = computed(() => {
  const { useWindowCount, maxWindowCount } = userInfo.value
  return Math.abs((useWindowCount / maxWindowCount) * 10 % 1)
})

const colorLevel = computed(() => {
  // 用量少于 50%，绿色
  if (percent.value <= 5) {
    return '#1CC94D'
  }
  // 用量多于50%，少于 80%，橙色
  else if (percent.value <= 8) {
    return '#FC9D12'
  }
  // 用量多于 80%，红色，提醒用户如果需要提高额度 则联系客服
  else {
    return '#F53838'
  }
})
</script>

<template>
  <div class="usage">
    <div class="usage-header">
      <div class="flex items-center gap-[2px]">
        <span>{{ $t('窗口用量') }}</span>
        <RxSvgIcon name="base/rx_ic_info" class="tips" size="12px" v-tooltip.top="$t('当前创建额度仅在产品 beta 期间有效')" />
      </div>
      <span>{{ userInfo.useWindowCount }}/{{ userInfo.maxWindowCount }}</span>
    </div>
    <div class="usage-body">
      <div v-for="num in 10" class="color-block"
        :class="{ 'color-level': num <= percent, 'last-item': num === percent }"></div>
    </div>
    <div class="need-more" v-if="percent > 8">
      <span>{{ $t('窗口不够？') }}</span>
      <LiveChat class="contact-us">
        {{ $t('联系我们') }}
        <RxSvgIcon name="base/rx_ic_arrow_right_2" size="12px" />
      </LiveChat>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.usage {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;
}

.usage-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */

  .tips {
    color: #C7CDD1;
  }
}

.usage-body {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  align-self: stretch;

  .color-block {
    height: 8px;
    flex: 1 0 0;
    background: var(--Color-neutrals-200, #E4E8EB);

    &:first-of-type {
      border-radius: 6px 0px 0px 6px;
    }

    &:last-of-type {
      border-radius: 0px 6px 6px 0px;
    }

    &.color-level {
      background-color: v-bind(colorLevel);

      &.last-item {
        opacity: v-bind(alpha);
      }
    }
  }
}

.need-more {
  display: flex;
  padding: 4px 8px;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  border-radius: 4px;
  background: var(--Color-neutrals-100, #F0F3F5);
  color: var(--Colors-Text-text-secondary, #575D61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
  /* 133.333% */

  .contact-us {
    color: var(--Colors-Text-text-brand, #12A3FC);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
    /* 133.333% */
  }
}
</style>
