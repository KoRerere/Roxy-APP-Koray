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

let rafId = 0
const duration = 15 * 1000;
const animationEnd = Date.now() + duration;
let skew = 1;
const defaultColors = ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'];

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function makeConfetti() {
  const timeLeft = animationEnd - Date.now();
  const ticks = Math.max(200, 500 * (timeLeft / duration));
  skew = Math.max(0.8, skew - 0.001);

  confetti({
    particleCount: 1,
    startVelocity: 0,
    zIndex: 100000,
    ticks: ticks,
    colors: [defaultColors[Math.floor(Math.random() * defaultColors.length)]],
    origin: {
      x: Math.random(),
      // since particles fall down, skew start toward the top
      y: (Math.random() * skew) - 0.2
    },
    gravity: randomInRange(0.4, 0.6),
    scalar: randomInRange(0.7, 1.8),
    drift: randomInRange(-0.4, 0.4)
  });

  if (timeLeft > 0) {
    rafId = requestAnimationFrame(makeConfetti);
  }
}

onBeforeMount(() => {
  userStore.fetchUserInfo()
  makeConfetti()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="redeem-successfully">
    <RxAvatar class="avatar" :avatar="userStore.userInfo.avatar" :name="userStore.userInfo.userName?.slice(0, 2)"
      :color="userStore.userInfo.avatarColor" :size="48" :font-size="12" />
    <div class="username">{{ userStore.userInfo.userName }}</div>
    <div class="user-level">
      <RxSvgIcon name="referral-program/diamond" size="16px" />
      <span class="text">{{ $t('Diamond') }}</span>
    </div>
    <div class="description">
      <i18n-t :keypath="$t('您当前已经是特邀用户。您的窗口创建额度已经提升至 {number}. ', { number: '{number}' })">
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
