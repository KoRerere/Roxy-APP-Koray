<template>
  <div id="lock-screen-wrapper" ref="markRef">
    <AnimatePresence>
      <motion.div 
        v-if="lockStore.isLocked" 
        class="overlay" 
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
            <div class="flex gap-2">
              <RxInputText type="password" v-model="password" placeholder="请输入密码" class="flex-1" @keydown.enter="handleUnlock" />
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
        </div>
      </motion.div>
    </AnimatePresence>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { $t } from "/@/locales";
import { useLock } from '/@/stores/lock'
import { showPageLoading } from "/@/utils";
import { useUserStore } from "/@/stores/user";
import { motion, AnimatePresence } from 'motion-v';

const password = ref('')
const emit = defineEmits(['show', 'close', 'delete'])
const toast = useToast()
const userStore = useUserStore()
const router = useRouter()

const lockStore = useLock()
const { lockData, resetLockData, setLockData } = lockStore
const markRef = ref()

// 触发解锁动作
const handleUnlock = () => {
  if (password.value === lockData.password) {
    setLockData({ openScreenLock: false })
    password.value = ''
  } else {
    toast.add({ severity: 'error', summary: $t('密码错误'), detail: $t('请重新输入密码'), life: 3000 });
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

// let observer: MutationObserver | null = null
// function watchElementRemoval(targetElement: HTMLElement, callback: () => void) {
//   if (observer) return;
//   observer = new MutationObserver((mutations) => {
//     for (const mutation of mutations) {
//       // 遍历 mutation.removedNodes，检查是否有目标元素
//       for (const node of Array.from(mutation.removedNodes)) {
//         if (node === targetElement || node.contains(targetElement)) {
//           observer && observer.disconnect(); // 解除监听
//           observer = null;
//           return callback();
//         }
//       }
//       console.log('mutation', mutation)
//     }
//   });

//   // 监听父节点的子节点变化
//   if (targetElement.parentElement) {
//     console.log('监听元素是否被删除')
//     observer.observe(targetElement.parentElement, { childList: true });
//   } else {
//     console.warn("目标元素没有父节点，无法监听删除事件");
//   }

//   return observer;
// }

let timer: NodeJS.Timeout | null = null
onMounted(() => {
  if (markRef.value && lockStore.isLocked) {
    // watchElementRemoval(markRef.value, () => {
    //   emit('delete')
    // })
    timer && clearInterval(timer)
    timer = setInterval(() => {
      // 防止用户把这个 id 属性删除掉。
      markRef.value.id = 'lock-screen-wrapper'

      const trendsMark = document.getElementById('TrendsMark')
      if (trendsMark) {
        document.body!.removeChild(trendsMark)
      }

      const mark = document.createElement('div');
      mark.id = 'TrendsMark'
      mark.style.position = 'absolute'
      mark.style.top = '0'
      mark.style.left = '0'
      mark.style.width = '100%'
      mark.style.height = '100%'
      mark.style.zIndex = '2147483646'
      mark.style.display = 'block'
      document.body!.appendChild(mark);
    }, 1000)
  }

  onBeforeUnmount(() => {
    const trendsMark = document.getElementById('TrendsMark')
    if (trendsMark) {
      document.body!.removeChild(trendsMark)
    }
    timer && clearInterval(timer)
  })
})
</script>

<style scoped lang="scss">
#lock-screen-wrapper {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 2147483647 !important;
  display: block !important;
  visibility: visible !important;  
}

.overlay {
  background-color: rgba(255, 255, 255, 0.5);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2;
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
  top: 46%;
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
