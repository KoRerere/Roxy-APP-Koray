<template>
  <AnimatePresence>
    <motion.div v-if="lockStore.isLocked" class="lock-screen-overlay" :initial="{ opacity: 0, scale: 0.98, backdropFilter: 'blur(0px)' }"
      :animate="{ opacity: 1, scale: 1, backdropFilter: 'blur(20px)' }" :exit="{ opacity: 0, scale: 0.98, backdropFilter: 'blur(0px)' }" :transition="{ duration: 0.25, ease: 'easeInOut' }">
      <div class="lock-screen-container">
        <div class="flex flex-col gap-12 content">
          <div class="flex flex-col items-center">
            <SvgIcon name="empty/screen_lock" size="128px" />
            <span class="locker-message">{{ $t('Roxy浏览器已被锁定') }}</span>
          </div>
          <div class="flex gap-2 relative">
            <Password v-model="password" :placeholder="$t('请输入密码')" @keydown.enter="handleUnlock" :invalid="invalid" autofocus @change="handleChange" ref="inputRef" :feedback="false" toggleMask :pt="{
              root: {
                class: 'flex-1'
              },
              pcInputText: {
                root: {
                  class: '!w-full'
                }
              }
            }" />

            <RxButton class="step-plus" icon="base/rx_ic_arrow_right_2" outlined severity="secondary" @click="handleUnlock" />

            <Message v-if="invalid" severity="error" size="small" variant="simple" class="absolute top-[calc(100%+4px)] left-[10px]">
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
import { API } from "/@/api";

const password = ref('')
const userStore = useUserStore()
const router = useRouter()
const inputRef = ref()

const lockStore = useLock()
const { resetLockData, closeLockMark, checkPassword } = lockStore
const invalid = ref(false)

// 触发解锁动作
const handleUnlock = async () => {
  const result = await checkPassword(password.value)
  if (result) {
    password.value = ''
    invalid.value = false
    closeLockMark();
  } else {
    inputRef.value?.$el?.querySelector('input')?.select()
    invalid.value = true;
  }
}

const handleChange = () => {
  invalid.value = false
}

let timer: NodeJS.Timeout | null = null;
let trendsMark: HTMLElement | null = null;

// 退出登录
const handleLogout = async () => {
  showPageLoading()
  userStore.clearRememberMe();
  // 先同步窗口数据并关闭浏览器(此时 token 仍有效, 主进程会显示同步进度), 同步完成后再登出,
  // 避免"数据还没同步完就退出登录"导致窗口数据丢失.
  await globalThis.electronAPI.send('user:logout').catch((error) => {
    console.warn('logout window sync failed (ignored):', error)
  })
  await API.base.userLogoutList().catch(() => {})
  userStore.clearUserInfo({ skipServerSync: true });
  resetLockData()
  unlock()
  password.value = ''
  router.push({ name: "login" });
}

// 上锁
function lock() {
  nextTick(() => inputRef.value?.$el?.querySelector('input')?.focus())
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

// 解锁
function unlock() {
  trendsMark && document.body!.removeChild(trendsMark)
  trendsMark = null;
  timer && clearInterval(timer)
  timer = null;
}

watch(() => lockStore.isLocked, (val) => {
  if (val) {
    lock()
  } else {
    unlock();
  }
})

onMounted(() => {
  if (lockStore.isLocked) {
    lock();
  }

  onBeforeUnmount(() => {
    unlock();
  })
})
</script>

<style scoped lang="scss">
.lock-screen-overlay {
  background: var(--colors-background-bg-blur, rgba(0, 0, 0, 0.40));
  // background-color: rgba(255, 255, 255, 0.5);
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
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
  /* 125% */
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
  color: var(--colors-text-text-primary, #111213);
  text-align: center;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
  /* 153.846% */
}
</style>
