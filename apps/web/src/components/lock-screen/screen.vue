<template>
  <AnimatePresence>
    <motion.div 
      v-if="lockStore.isLocked" 
      class="lock-screen-overlay"
      :initial="{ opacity: 0, scale: 0.98, backdropFilter: 'blur(0px)' }" 
      :animate="{ opacity: 1, scale: 1, backdropFilter: 'blur(20px)' }"
      :exit="{ opacity: 0, scale: 0.98, backdropFilter: 'blur(0px)' }"
      :transition="{ duration: 0.25, ease: 'easeInOut' }"
    >
      <div class="lock-screen-container">
        <div class="flex flex-col gap-12 content">
          <div class="flex flex-col items-center">
            <SvgIcon name="empty/screen_lock" size="128px" />
            <span class="locker-message">{{ $t('RoxyBrowser 已被锁定') }}</span>
          </div>
          <div class="flex gap-2 relative">
            <RxInputText 
              type="password" 
              v-model="password" 
              placeholder="请输入密码" 
              class="flex-1" 
              @keydown.enter="handleUnlock" 
              :invalid="invalid"
              autofocus
              @change="handleChange"
              ref="inputRef"
            />

            <RxButton class="step-plus" icon="base/rx_ic_arrow_right_2" outlined severity="secondary" @click="handleUnlock" />

            <Message v-if="invalid" severity="error" size="small" variant="simple" class="absolute top-[calc(100%+4px)] left-[6px]">
              {{ $t('密码错误') }}
            </Message>
          </div>
          
        </div>

        <div class="absolute top-[24px] right-[24px]">
          <div class="logout-button" @click="handleLogout">
            <SvgIcon name="base/rx_ic_logout" size="16" />
            <span class="logout-button-text">{{ $t('退出登录') }}</span>
          </div>
        </div>
      </div>
    </motion.div>
  </AnimatePresence>
</template>

<script setup lang="ts">
import { $t } from "/@/locales";
import { useLock } from '/@/stores/lock'
import { showPageLoading } from "/@/utils";
import { useUserStore } from "/@/stores/user";
import { motion, AnimatePresence } from 'motion-v';

const password = ref('')
const userStore = useUserStore()
const router = useRouter()
const inputRef = ref()

const lockStore = useLock()
const { lockData, resetLockData, setLockData } = lockStore
const invalid = ref(false)

// 触发解锁动作
const handleUnlock = () => {
  if (password.value === lockData.password) {
    setLockData({ openScreenLock: false })
    password.value = ''
    invalid.value = false
  } else {
    inputRef.value?.$el?.querySelector('input')?.select()
    invalid.value = true;
  }
}

const handleChange = () => {
  invalid.value = false
}

// 退出登录
const handleLogout = () => {
  showPageLoading()
  userStore.clearUserInfo();
  resetLockData()
  router.push({ name: "login" });
}

let timer: NodeJS.Timeout | null = null;
let trendsMark: HTMLElement | null = null;
onMounted(() => {
  if (lockStore.isLocked) {
    timer && clearInterval(timer)
    timer = setInterval(() => {
      trendsMark && document.body!.removeChild(trendsMark)
      const mark = document.createElement('div');
      mark.style.position = 'absolute'
      mark.style.top = '0'
      mark.style.left = '0'
      mark.style.width = '100%'
      mark.style.height = '100%'
      mark.style.zIndex = '2147483646'
      mark.style.display = 'block'
      trendsMark = mark
      document.body!.appendChild(mark);
    }, 1000)
  }

  onBeforeUnmount(() => {
    trendsMark && document.body!.removeChild(trendsMark)
    timer && clearInterval(timer)
  })
})
</script>

<style scoped lang="scss">
.lock-screen-overlay {
  background-color: rgba(255, 255, 255, 0.5);
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 2147483647 !important;
  visibility: visible !important;  
  display: flex !important;
  justify-content: center;
  align-items: center;
}

.lock-screen-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
}

.content {
  position: relative;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 348px;
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
