<script lang="ts" setup>
import { useWorkspaceStore } from '/@/stores/workspace'
import AsideMenu from './components/aside-menu/index.vue'
import RxLayoutFooter from './components/footer/index.vue'
import RxLayoutHeader from './components/header/index.vue'

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const collapsed = ref<boolean>(false)
const transitionend = ref<boolean>(true)
const loading = ref<boolean>(false)

watch(() => currentWorkspace.value?.id, () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 2200)
}, { immediate: true })

function handleSideTransitionend() {
  transitionend.value = true
}

function handleSideTransitionstart() {
  transitionend.value = false
}
</script>

<template>
  <div v-show="loading" class="absolute inset-0 flex flex-col items-center justify-center gap-[16px] z-10 bg-white/90">
    <SvgIcon name="base/logo" size="64" />
    <img class="w-8 h-8 loading-circle" src="/@/assets/images/status/loading.png">
  </div>
  <div v-show="!loading" class="rx-layout">
    <div class="rx-side" :class="{ collapsed, transitionend }" @transitionstart="handleSideTransitionstart" @transitionend="handleSideTransitionend">
      <div class="logo">
        <SvgIcon name="base/logo" size="32" />
        <template v-if="!collapsed">
          <span>
            RoxyBrowser
          </span>
          <div class="env">
            BETA
          </div>
        </template>
      </div>
      <AsideMenu v-if="currentWorkspace?.id" :collapsed :transitionend />
      <RxLayoutFooter v-model:collapsed="collapsed" />
    </div>
    <main class="rx-main">
      <RxLayoutHeader />
      <div class="rx-main-content">
        <RouterView v-if="currentWorkspace?.id" :key="currentWorkspace?.id" />
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.rx-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--Colors-Background-bg-page, #fafbfc);
}

.rx-side {
  position: relative;
  display: flex;
  width: 220px;
  padding: var(--spacing-2xl, 16px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  flex-shrink: 0;
  transition: all 0.25s ease;
  will-change: width;
  overflow: hidden;
  user-select: none;

  &.collapsed {
    width: 64px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 6px);
    flex-wrap: nowrap;
    color: var(--Color-neutrals-950, #0e1214);
    text-align: center;
    font-family: Archivo;
    font-size: 14px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
    user-select: none;

    .env {
      display: flex;
      padding: var(--spacing-xs, 2px) var(--spacing-md, 6px);
      justify-content: center;
      align-items: center;
      gap: 10px;
      color: var(--Colors-Text-text-tertiary, #7c8387);
      text-align: center;
      font-family: Archivo;
      font-size: 10px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
      letter-spacing: 0.1px;
      border-radius: var(--radius-full, 9999px);
      background: var(--Color-neutrals-200, #e4e8eb);
    }
  }
}

.rx-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &-content {
    flex: 1;
    margin-right: var(--spacing-2xl, 16px);
    margin-bottom: var(--spacing-2xl, 16px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background-color: #ffffff;
    overflow: hidden;
  }
}
</style>
