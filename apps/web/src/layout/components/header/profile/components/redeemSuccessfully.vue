<script setup lang="ts">
import confetti from 'canvas-confetti'
import { useUserStore } from '/@/stores/user';
import { RxSvgIcon } from '/@/components/rx-icon/'

const props = defineProps({
  hideFn: Function,
})

const userStore = useUserStore()

function hide() {
  props.hideFn?.()
}

var count = 200;
var defaults = {
  origin: { y: 0.45 },
  zIndex: 10000000
};

function fire(particleRatio, opts) {
  confetti({
    ...defaults,
    ...opts,
    particleCount: Math.floor(count * particleRatio)
  });
}

fire(0.25, {
  spread: 26,
  startVelocity: 55,
});
fire(0.2, {
  spread: 60,
});
fire(0.35, {
  spread: 100,
  decay: 0.91,
  scalar: 0.8
});
fire(0.1, {
  spread: 120,
  startVelocity: 25,
  decay: 0.92,
  scalar: 1.2
});
fire(0.1, {
  spread: 120,
  startVelocity: 45,
});

onBeforeMount(() => {
  userStore.fetchUserInfo()
})
</script>

<template>
  <div class="redeem-successfully">
    <RxAvatar class="avatar" :avatar="userStore.userInfo.avatar" :name="userStore.userInfo.userName?.slice(0, 2)"
      :color="userStore.userInfo.avatarColor" :size="48" :font-size="12" />
    <div class="username">{{ userStore.userInfo.userName }}</div>
    <div class="user-level">
      <RxSvgIcon name="referral-program/diamond" size="16px" />
      <span class="text">{{ userStore.identityText }}</span>
    </div>
    <div class="description">
      <i18n-t
        :keypath="$t('您当前已经是{identity}。您的窗口创建额度已经提升至 {number}. ', { number: '{number}', identity: '{identity}' })">
        <template #identity>
          <span class="number">{{ userStore.identityText }}</span>
        </template>
        <template #number>
          <span class="number">{{ userStore.userInfo.maxWindowCount }}</span>
        </template>
      </i18n-t>
    </div>
    <RxButton class="w-full" :label="$t('返回工作空间')" @click="hide" />
  </div>
</template>


<style lang="scss" scoped>
.redeem-successfully {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.username {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px);
  /* 128.571% */
}

.user-level {
  display: flex;
  align-items: center;
  gap: 2px;

  .text {
    color: var(--Color-blue-300, #12A3FC);
    font-family: "DingTalk JinBuTi";
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }
}

.description {
  color: var(--Color-neutrals-600, #575D61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px);
  /* 150% */

  .number {
    color: var(--Colors-Text-text-primary, #171C1F);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-sm, 18px);
  }
}
</style>
