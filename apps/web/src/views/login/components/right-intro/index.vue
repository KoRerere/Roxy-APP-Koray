<script setup lang="ts">
import { $t } from '/@/locales';
import { motion } from 'motion-v';
import MultiAccounting from './MultiAccounting.vue';
import ProfilesSyncing from './ProfilesSyncing.vue';
import SupportMorePlatform from './SupportMorePlatform.vue';
import TeamSpace from './TeamSpace.vue';

const tabs = [
  {
    key: 'SupportMorePlatform',
    title: $t('Support More Platform'),
    desc: $t('Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nunc at accumsan dui. Curabitur semper ex sed tincidunt cursus.'),
    component: SupportMorePlatform,
  },
  {
    key: 'MultiAccounting',
    title: $t('Multi Accounting'),
    desc: $t('Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nunc at accumsan dui. Curabitur semper ex sed tincidunt cursus.'),
    component: MultiAccounting
  },
  {
    key: 'ProfilesSyncing',
    title: $t('Profiles Syncing'),
    desc: $t('Integer dui odio, placerat venenatis enim eu, congue hendrerit libero. Donec cursus ultrices rhoncus. Mauris ultrices ultrices eros sed ultricies.'),
    component: ProfilesSyncing
  },
  {
    key: 'TeamSpace',
    title: $t('Team Space'),
    desc: $t('Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nunc at accumsan dui. Curabitur semper ex sed tincidunt cursus.'),
    component: TeamSpace
  }
]

const currentTab = ref('SupportMorePlatform')
const progressWidth = ref(100);
const FULL_PROGRESS = 100; // 进度条最大值（100%）
const intervalTime = 8000; // 8秒
let animationFrameId: number | null = null; // 存储 RAF ID
let progressStartTime: number | null = null; // 记录动画开始时间

// 切换标签并重置倒计时
function switchTab(tab: string) {
  if (currentTab.value === tab) return;
  currentTab.value = tab;
  resetTimer();
}

function resetTimer() {
  resetProgress();
  startTimers();
}

function switchToNextTab() {
  const currentIndex = tabs.findIndex(item => item.key === currentTab.value);
  if (currentIndex === tabs.length - 1) {
    currentTab.value = tabs[0].key;
  } else {
    currentTab.value = tabs[currentIndex + 1].key
  }
  resetProgress();
}

// 重置进度条到100%
function resetProgress() {
  progressWidth.value = FULL_PROGRESS;
}

// 开始计时器
function startTimers() {
  clearExistingTimers()

  progressStartTime = performance.now(); // 记录开始时间
  animateProgressBar();
}

// 进度条动画（RAF 实现）
function animateProgressBar() {
  if (!progressStartTime) return;

  const elapsedTime = performance.now() - progressStartTime;
  const progressPercentage = Math.max(0, FULL_PROGRESS - (elapsedTime / intervalTime) * FULL_PROGRESS);

  progressWidth.value = progressPercentage;

  if (progressPercentage <= 0) {
    progressStartTime = performance.now();
    switchToNextTab()
  }

  animationFrameId = requestAnimationFrame(animateProgressBar);
}

// 清除现有计时器和动画
function clearExistingTimers() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  progressStartTime = null; // 重置开始时间
}

// 组件挂载时启动计时器
onMounted(() => {
  startTimers();
});

// 组件卸载时清除计时器
onUnmounted(() => {
  clearExistingTimers()
});
</script>

<template>
  <div class="mt-100px ml-100px">
    <template v-for="tab in tabs">
      <motion.div class="intro" v-if="currentTab === tab.key" :initial="{ opacity: 0, y: -30 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }">
        <div class="intro-title">{{ tab.title }}</div>
        <div class="intro-desc">{{ tab.desc }}</div>
      </motion.div>
    </template>
    <ul class="indicator-bar">
      <li v-for="tab in tabs" :class="{ active: currentTab === tab.key }" @click="switchTab(tab.key)">
        <div class="indicator-bar-item" :style="currentTab === tab.key ? { width: progressWidth + '%' } : {}"></div>
      </li>
    </ul>
  </div>

  <template v-for="tab in tabs">
    <component :is="tab.component" v-if="currentTab === tab.key" />
  </template>
</template>

<style lang="scss" scoped>
.intro {
  .intro-title {
    display: inline-block;
    padding: 8px 12px;
    background-color: #FFF;
    color: var(--colors-text-text-brand);
    border-radius: 6px;
    font-family: Archivo;
    font-size: 20px;
    font-weight: 700;
    line-height: 20px;
  }

  .intro-desc {
    color: #FFF;
    font-family: Inter;
    font-size: 16px;
    font-weight: 400;
    line-height: 25.6px;
    margin: 16px 0;
  }

}

[data-theme="dark"] {
  .intro-title {
    background-color: var(--colors-alpha-alpha-black-60);
    color: var(--colors-text-text-primary);
  }
}

.indicator-bar {
  list-style: none;
  display: flex;
  flex-direction: row;
  padding: 0;
  margin: 0;
  gap: 16px;

  li {
    display: block;
    padding: 4px 4px;
    cursor: pointer;
    width: 104px;
    position: relative;

    .indicator-bar-item {
      position: absolute;
      top: 4px;
      // right: -4px;
      left: 4px;
      height: 6px;
      background-color: #ffffff;
      border-radius: 6px;
      transition: width 0.1s linear;
    }

    &:after {
      content: '';
      display: block;
      width: 104px;
      height: 6px;
      background-color: #ffffff;
      border-radius: 6px;
      opacity: 0.2;
    }

    &.active {
      div {
        opacity: 1;
      }
    }
  }
}
</style>