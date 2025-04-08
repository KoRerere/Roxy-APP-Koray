<template>
  <div class="flex flex-col gap-12 content">
    <div class="flex flex-col items-center">
      <SvgIcon name="empty/rx_locker_desktop" size="128px" />
      <span class="locker-message">{{ $t('RoxyBrowser 已被锁定') }}</span>
    </div>
    <div class="flex gap-2">
      <RxInputText v-model="password" placeholder="请输入密码" class="flex-1" />
      <RxButton class="step-plus" outlined severity="secondary" @click="handleUnlock">
        <template #icon>
          <SvgIcon name="base/rx_ic_arrow_right_2" size="12" />
        </template>
      </RxButton>
    </div>
  </div>

  <div class="absolute top-[24px] right-[24px]">
    <div class="logout-button" @click="handleLogout">
      <SvgIcon name="base/rx_ic_logout" size="16" />
      <span class="logout-button-text">{{ $t('退出登录') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { $t } from "/@/locales";
import { useLock } from '/@/stores/lock'
import { showPageLoading } from "/@/utils";
import { useUserStore } from "/@/stores/user";

const password = ref('')
const emit = defineEmits(['show', 'close'])
const toast = useToast()
const userStore = useUserStore()
const router = useRouter()

const { lockData, resetLockData } = useLock()

// 触发解锁动作
const handleUnlock = () => {
  if (password.value === lockData.password) {
    emit('close')
  } else {
    toast.add({ severity: 'error', summary: '密码错误', detail: '请重新输入密码', life: 3000 });
  }
}

// 退出登录
const handleLogout = () => {
  emit('close')
  showPageLoading()
  userStore.clearUserInfo();
  resetLockData()
  router.push({ name: "login" });
}
</script>

<style scoped lang="scss">
.content {
  position: relative;
  top: 447px;
  width: 348px;
  margin: 0 auto;
}

.locker-message {
  color: var(--Colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px; /* 125% */
}

.logout-button {
  display: inline-flex;
  min-width: 80px;
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  cursor: pointer;
}

.logout-button-text {
  color: var(--Colors-text-text-primary, #111213);
  text-align: center;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
}
</style>
