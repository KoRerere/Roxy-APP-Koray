<script setup lang="ts">
import confetti from 'canvas-confetti'
import { useUserStore } from '/@/stores/user';
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales';
import Privileges from './privileges.vue';

const props = defineProps({
  hideFn: Function,
  showConfetti: Boolean,
})

const userStore = useUserStore()

const welcomeText = computed(() => {
  const { identity } = userStore.userInfo
  if (identity === 'old') {
    return $t('感谢您的长期支持，作为 Roxy 最早期用户，您享有权益如下：')
  } else if (identity === 'invited') {
    return $t('感谢您的支持，您享有权益如下：')
  } else if (identity === 'agent') {
    return $t('作为 Roxy 的合作伙伴，您享有权益如下：')
  }
  return $t('欢迎加入Roxy，您享有权益如下：')
})



function hide() {
  props.hideFn?.()
}

function initConfetti() {
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
}

onMounted(() => {
  if (props.showConfetti) {
    initConfetti()
  }
})

onBeforeMount(() => {
  userStore.fetchUserInfo()
})
</script>

<template>
  <div class="redeem-successfully">
    <RxAvatar class="avatar" :avatar="userStore.userInfo.avatar" :name="userStore.userInfo.userName?.slice(0, 2)"
      :color="userStore.userInfo.avatarColor" :size="48" :font-size="24" />
    <div class="username">{{ userStore.userInfo.userName }}</div>
    <div class="user-level">
      <RxSvgIcon :name="userStore.identityInfo.icon" size="16px" />
      <span class="text" :style="{ color: userStore.identityInfo.color }">{{ userStore.identityInfo.text }}</span>
    </div>
    <div class="description">
      <span class="welcome-text">{{ welcomeText }}</span>
      <Privileges />
    </div>
    <RxButton class="w-full mt-[16px]" :label="$t('了解')" @click="hide" />
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
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-sm, 18px);
  /* 112.5% */
}

.user-level {
  display: flex;
  align-items: center;
  gap: 2px;

  .text {
    color: var(--pattern-sidenav-text-active, #3FB6FD);
    font-family: "DingTalk JinBuTi";
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }
}

.description {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-self: stretch;
  color: var(--primitives-neutrals-600, #575D61);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-sm, 18px);


}
</style>
