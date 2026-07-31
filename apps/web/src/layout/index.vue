<script lang="ts" setup>
import Announcement from '/@/layout/components/header/announcement.vue'
import RolesOverview from '/@/views/team/components/roles-overview.vue'
import AsideMenu from './components/aside-menu/index.vue'
import RxLayoutFooter from './components/footer/index.vue'
import RxLayoutHeader from './components/header/index.vue'
import RxLoading from '/@/components/rx-loading.vue'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import { useWorkspaceStore } from '/@/stores/workspace'
import { MENU_COLLAPSED } from '../constants/storage-key'
import { useSimpleLocale } from '/@/stores/locale'
import { useRouteContext } from '/@/composables/useRouteContext'

const { isEcommerce } = useRouteContext()
const { realTheme } = storeToRefs(useThemeStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { currentWorkspace } = storeToRefs(useWorkspaceStore())

const payInfoLoading = computed(() => Boolean(currentWorkspace.value?.id && !userPayInfo.value?.subLevel))

const collapsed = ref<boolean>(Boolean(~~(localStorage.getItem(MENU_COLLAPSED) as string)))

const indicatorColor = computed(() => {
  return realTheme.value === 'dark' ? '#FFFFFF33' : 'rgba(0, 0, 0, 0.1)'
})

watchEffect(() => {
  localStorage.setItem(MENU_COLLAPSED, collapsed.value ? '1' : '0')
})

const { currentLocale, isZh } = storeToRefs(useSimpleLocale())

const imageSrc = computed(() => {
  const suffix = ['zh-CN', 'en'].includes(currentLocale.value!) ? currentLocale.value : 'en'
  const theme = realTheme.value === 'dark' ? 'dark' : 'light'
  return `/images/roxybrowser_text_${theme}_${suffix}.svg`
})

const imageSrcEcommerce = computed(() => {
  const theme = realTheme.value === 'dark' ? 'dark' : 'light'
  return isZh.value ? `/images/roxybrowser1_text_${theme}_zh-CN.svg` : `/images/roxybrowser_text_${theme}_en.svg`
})
</script>

<template>
  <div class="rx-layout">
    <div class="rx-side" :class="{ collapsed }">
      <div class="indicator" :title="collapsed ? $t('展开') : $t('收起')" @click="collapsed = !collapsed">
        <SvgIcon name="indicator/indicator_default" class="default" />
        <SvgIcon name="indicator/indicator_expand" class="expand" />
        <SvgIcon name="indicator/indicator_fold" class="fold" />
      </div>
      <div v-if="isEcommerce" class="logo">
        <SvgIcon name="base/logo" size="36" />
        <template v-if="!collapsed">
          <img draggable="false" class="block h-5" :src="imageSrcEcommerce">
        </template>
      </div>
      <div v-else class="logo">
        <SvgIcon name="base/logo" size="36" />
        <template v-if="!collapsed">
          <img draggable="false" class="block h-5" :src="imageSrc">
        </template>
      </div>
      <AsideMenu :collapsed />
      <RxLayoutFooter v-model:collapsed="collapsed" />
    </div>
    <main class="flex-1 flex flex-col overflow-hidden">
      <RxLayoutHeader />
      <Announcement />
      <RolesOverview />
      <div class="flex-1 mr-4 mb-4 rounded overflow-hidden relative flex min-h-0 flex-col rx-main-content">
        <RouterView v-if="currentWorkspace?.id" :key="currentWorkspace?.id" />
        <RxLoading :model-value="payInfoLoading" :opacity="0.9" />
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
}

.rx-side {
  position: relative;
  display: flex;
  width: 220px;
  padding: var(--spacing-2xl, 16px);
  padding-top: 11px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  flex-shrink: 0;
  transition: all 0.25s ease;
  will-change: width;
  // overflow: hidden;
  user-select: none;
  background-image: url('/images/bg_capella.svg');
  background-position: bottom -210px right -185px;
  background-repeat: no-repeat;

  &.collapsed {
    width: 66px;

    .indicator {
      right: 0;
      left: 100%;

      &:hover {
        .expand {
          display: block;
        }

        .fold {
          display: none;
        }
      }
    }
  }

  .indicator {
    position: absolute;
    top: 50%;
    right: -5px;
    transform: translateY(-50%);
    cursor: pointer;
    z-index: 10;
    padding: 10px;
    color: v-bind(indicatorColor);

    svg {
      width: 11px;
      height: 38px;
    }

    .default {
      width: 6px;
    }

    .fold,
    .expand {
      display: none;
    }

    &:hover {
      .fold {
        display: block;
      }

      .default {
        display: none;
      }
    }
  }

  .logo {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
    color: var(--colors-text-text-primary);
    text-align: center;
    font-family: Archivo;
    font-size: 18px;
    line-height: normal;
    user-select: none;
    overflow: hidden;
    font-weight: 700;
  }
}

.rx-main-content {
  position: relative;
  border: 0.5px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-page);
  z-index: 0;

  :deep(> *) {
    min-height: 0;
    height: 100%;
  }
}

.expired-alert {
  padding: 8px 12px;

  :deep(.rx-alert__title) {
    font-size: 13px;
    font-weight: normal;
  }
}
</style>
