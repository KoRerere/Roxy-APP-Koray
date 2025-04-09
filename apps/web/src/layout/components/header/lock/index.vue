<template>
  <template v-if="!!lockData.password">
    <RxButton icon="base/rx_ic_unlock2" severity="secondary" outlined size="xs" @click="handleOpenLocker" />
    <Divider class="!ma-0" layout="vertical" />
  </template>
</template>

<script setup lang="ts">
import { useLock } from '/@/stores/lock'
import { useDialog } from "primevue/usedialog"
import LockScreen from './lock-screen.vue'

const dialog = useDialog()
const { lockData, setLockData } = useLock()
const lockScreen = useCssModule('lockScreen')

const handleOpenLocker = () => {
  setLockData({ openScreenLock: true })
  openLocker()
}

function openLocker() {
  
  // 遮罩层元素的id
  const MASK_ID = 'locker-dialog-mask'

  // 监听元素删除事件(防止用户通过浏览器开发者工具删除元素来绕开应用锁)
  function watchElementRemoval(targetElement: HTMLElement, callback: () => void) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 遍历 mutation.removedNodes，检查是否有目标元素
        for (const node of Array.from(mutation.removedNodes)) {
          if (node === targetElement || node.contains(targetElement)) {
            callback();
            observer.disconnect(); // 解除监听
            return;
          }
        }
      }
    });

    // 监听父节点的子节点变化
    if (targetElement.parentElement) {
      observer.observe(targetElement.parentElement, { childList: true });
    } else {
      console.warn("目标元素没有父节点，无法监听删除事件");
    }

    return observer;
  }

  const lockerDialog = dialog.open(LockScreen, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      draggable: false,
      pt: {
        mask: {
          id: MASK_ID,
          class: lockScreen.mask
        },
        root: {
          class: lockScreen['mask-root']
        }
      },
      contentClass: lockScreen['mask-content']
    },
    emits: {
      onShow: () => {
        const mask = document.getElementById(MASK_ID)
        if (mask) {
          watchElementRemoval(mask, openLocker)
        }
      },
      onClose: () => {
        // 关闭了
        lockerDialog.close()
        setLockData({ openScreenLock: false })
      }
    }
  })
}

// watch(lockData, (newVal) => {
//   if (newVal.openScreenLock) {
//     openLocker()
//   }
// })

onMounted(() => {
  if (lockData.openScreenLock) {
    openLocker()
  }
})
</script>

<style lang="scss" module="lockScreen">
.mask {
  background: var(--Colors-background-bg-blur, rgba(255, 255, 255, 0.60)) !important;
  backdrop-filter: blur(30px);
  display: block !important;
}

.mask-root {
  position: absolute;
  width: 100%;
  height: 100%;
  // 重置一些样式
  background-color: transparent;
  border: none;
  box-shadow: none;
  max-height: 100% !important;
}

.mask-content {
  height: 100%;
  width: 100%;
}
</style>