<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'
import { motion, AnimatePresence } from 'motion-v'

const themeStore = useThemeStore()

const img1 = computed(() => {
  return `/images/login/${themeStore.realTheme}/team-space.png`
})

const logs = ref([
  {
    id: 1,
    imgUrl: '',
    role: 'Manager',
    content: 'Invite user support@roxybrowser.com to project Amazon Shop.',
    color: '#11A3FD',
    workspace: 'Amazon',
  },
  {
    id: 2,
    imgUrl: '',
    role: 'Viewer',
    content: 'Open and check profile, profile index: ROX-190',
    color: '#F8981D',
    workspace: 'Facebook',
  },
  {
    id: 3,
    imgUrl: '',
    role: 'Viewer',
    content: 'Open and check profile, profile index: ROX-187',
    color: '#F8981D',
    workspace: 'Facebook',
  },
  {
    id: 4,
    imgUrl: '',
    role: 'Editor',
    content: 'Plugin installed to Shopify Shop.',
    color: '#DA4C4C',
    workspace: 'Shopify',
  },
  {
    id: 5,
    imgUrl: '',
    role: 'Manager',
    content: 'Invite user support@roxybrowser.com to project Amazon Shop.',
    color: '#11A3FD',
    workspace: 'Amazon',
  },
  {
    id: 6,
    imgUrl: '',
    role: 'Editor',
    content: 'Modified 1 profile, profile index: ROX-203',
    color: '#DA4C4C',
    workspace: 'Amazon',
  }
])

const visibleLogs = ref([
  logs.value[0], // id: 1
  logs.value[1], // id: 2
  // logs.value[2]  // id: 3
]);

let currentIndex = 2;
let logRotationInterval: NodeJS.Timeout | null = null;

// 日志轮播函数
function rotateLogs() {
  // 检查是否还有更多日志要添加
  if (currentIndex >= logs.value.length) {
    logRotationInterval && clearInterval(logRotationInterval);
    return;
  }

  visibleLogs.value.shift();

  visibleLogs.value.push(logs.value[currentIndex]);

  currentIndex++;
}

function startLogRotation() {
  logRotationInterval = setInterval(rotateLogs, 2000);
}

onMounted(() => {
  startLogRotation()
})

onUnmounted(() => {
  logRotationInterval && clearInterval(logRotationInterval);
})

</script>

<template>
  <div class="select-none">
    <motion.div class="absolute w-1000px left-156px -bottom-205px" :initial="{ opacity: 0, y: 100 }"
      :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }">
      <img :src="img1" alt="" class="w-full select-none opacity-60" draggable="false">
    </motion.div>
    <motion.div class="team-logs" layout :data-length="visibleLogs.length" :initial="{ opacity: 0, y: 100 }"
      :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01], delay: 0.2 }">
      <AnimatePresence :initial="false" mode="popLayout">
        <motion.div layout v-for="log in visibleLogs" :key="log.id" class="log-item"
          :initial="{ opacity: 0, y: 50, scale: 0.3 }" :animate="{
            opacity: 1,
            y: 0,
            scale: 1,
          }" :exit="{
            opacity: 0,
            scale: 0.5,
            y: -50,
          }">
          <p class="workspace">Workspace: {{ log.workspace }}</p>
          <div class="log-notification">
            <div class="log-wrapper">
              <div class="log-divider" :style="{ backgroundColor: log.color }"></div>
              <div class="log-user">
                <img :src="`/images/login/image-${log.id}.jpg`" class="select-none" draggable="false">
                <p class="log-role text-[var(--colors-text-text-primary)]">{{ log.role }}</p>
              </div>
              <p class="log-content text-[var(--colors-text-text-secondary)] leading-[1.5]">{{ log.content }}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  </div>
</template>

<style scoped lang="scss">
.team-logs {
  position: absolute;
  width: 360px;
  height: 300px;
  top: 28%;
  left: 12%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 12px;

  .log-item {
    .workspace {
      font-size: 14px;
      color: #ffffff;
      font-weight: 600;
      margin-bottom: 8px;
      padding-right: 24px;
      text-align: right;
    }

    .log-wrapper {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-left: 16px;
      position: relative;

      .log-divider {
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        border-radius: 4px;
      }

      .log-content {
        font-size: 14px;
        margin: 0;
      }

      .log-user {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;

        img {
          display: block;
          width: 32px;
          height: 32px;
          border-radius: 100%;
        }

        .log-role {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
      }
    }
  }
}

.log-notification {
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.90);
  box-shadow: 0px 1.91px 10.825px 0px rgba(0, 0, 0, 0.04), 0px 2.547px 19.104px 0px rgba(0, 0, 0, 0.12);
  padding: 16px;
}

[data-theme="dark"] .log-notification {
  background: rgb(16, 44, 57);
}
</style>