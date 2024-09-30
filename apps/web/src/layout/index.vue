<script lang="ts" setup>
import type { UserGetDictVersionListData, UserGetSystemDictV2CreateData } from '@roxy/backend-api'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isEmptyValue } from '/@/utils'
import AsideMenu from './components/aside-menu/index.vue'
import RxLayoutFooter from './components/footer/index.vue'
import RxLayoutHeader from './components/header/index.vue'

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const collapsed = ref<boolean>(false)
const transitionend = ref<boolean>(true)

type DictMap = UserGetDictVersionListData['data']
type DictItem = UserGetSystemDictV2CreateData['data'][0]

async function getDictVersion() {
  const { data: newVersion } = await API.base.userGetDictVersionList()
  const oldVersion = JSON.parse(localStorage.getItem('$dict_version') || 'null')

  const needUpdateDict = isEmptyValue(oldVersion)
    ? newVersion
    : Object.fromEntries(Object.entries(newVersion).filter(([key, value]) => oldVersion[key as keyof DictMap] !== value))

  if (!isEmptyValue(needUpdateDict)) {
    localStorage.setItem('$dict_version', JSON.stringify(newVersion))
    getDictData(Object.keys(needUpdateDict))
  }
}

async function getDictData(type: any) {
  const { data } = await API.base.userGetSystemDictV2Create({ type })
  const dictMap = data.reduce((map, item) => {
    (map[item.type] || (map[item.type] = [])).push(item)
    return map
  }, {} as Record<string, DictItem[]>)
  localStorage.setItem('$dict_map', JSON.stringify(dictMap))
}

onMounted(() => {
  getDictVersion()
})

function handleSideTransitionend() {
  transitionend.value = true
}

function handleSideTransitionstart() {
  transitionend.value = false
}

onMounted(async () => {
  const systemProxy = await electronAPI.send('proxy:getSystemProxy')
  const [host, port] = systemProxy.split(':')
  console.log('systemProxy', systemProxy)
  const data = await electronAPI.send('proxy:detect', { protocol: 'HTTP', host, port })
  console.log('data', data)
})
</script>

<template>
  <div class="rx-layout">
    <div class="rx-side" :class="{ collapsed, transitionend }" @transitionstart="handleSideTransitionstart"
      @transitionend="handleSideTransitionend">
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
