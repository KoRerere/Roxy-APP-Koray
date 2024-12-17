<script lang="ts" setup>
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import AsideMenu from './components/aside-menu/index.vue'
import RxLayoutFooter from './components/footer/index.vue'
import RxLayoutHeader from './components/header/index.vue'
import { emitter } from '../utils/eventBus'

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const collapsed = ref<boolean>(false)
const transitionend = ref<boolean>(true)
const loading = ref<boolean>(false)
const anntList = ref()

watch(() => currentWorkspace.value?.id, () => {
  loading.value = true
  setTimeout(() => {
    loading.value = !currentWorkspace.value?.id
  }, 1200)
}, { immediate: true })

function handleSideTransitionend() {
  transitionend.value = true
}

function handleSideTransitionstart() {
  transitionend.value = false
}

async function getAnnt() {
  const { data } = await API.base.userGetAnntListList()
  anntList.value = data.rows
}

onBeforeMount(() => {
  getAnnt()
})
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
      <AsideMenu :collapsed :transitionend />
      <RxLayoutFooter v-model:collapsed="collapsed" />
    </div>
    <main class="rx-main">
      <RxLayoutHeader />
      <div class="rx-main-announcement">
        <Message v-for="annt in anntList" :key="annt.id" severity="success" class="w-full rx-main-announcement__content" closable>
          <template #default>
            <div class="ellipsis-1" v-html="annt.announcement" />
          </template>
          <template #closeicon>
            <SvgIcon name="base/rx_ic_delete" />
          </template>
        </Message>
      </div>
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
    width: 66px;
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
      color: var(--Colors-Text-text-brand, #12a3fc);
      text-align: center;
      font-family: Archivo;
      font-size: 10px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
      letter-spacing: 0.1px;
      border-radius: var(--radius-full, 9999px);
      background: var(--Color-blue-100, #e8f5fc);
    }
  }
}

.rx-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &-announcement {
    margin-right: var(--spacing-2xl, 16px);

    &__content {
      margin-top: var(--spacing-lg, 8px);
      border-radius: 4px;
      background: #303256;
      outline-style: none;
      outline-width: 0;

      &:first-of-type {
        margin-top: 0;
      }

      &:last-of-type {
        margin-bottom: var(--spacing-xl, 12px);
      }
    }

    :deep(a) {
      color: #ffffff;
      text-decoration: underline;
    }

    :deep(.p-message-content) {
      padding: var(--spacing-lg, 10px) var(--spacing-xl, 12px);
    }

    :deep(.p-message-text) {
      width: 95%;
      color: #ffffff;
      font-family: Inter;
      font-size: 13px;
      line-height: 16px;
    }

    :deep(.p-message-close-button) {
      color: #ffffff;
      width: auto;
      height: auto;

      &:hover {
        background-color: transparent;
      }
    }
  }

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
