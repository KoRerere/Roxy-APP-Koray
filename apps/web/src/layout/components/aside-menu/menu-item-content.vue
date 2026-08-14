<script setup lang="ts">
// import { getImage } from '/@/utils/basic'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useSimpleLocale } from '/@/stores/locale'
// import { useThemeStore } from '/@/stores/theme'
import { useProxy } from '/@/views/agent/hooks'
import { menuActionHandlers } from '/@/router/menu-shared'
import { emitter } from '/@/utils/eventBus'
import type { RouteRecordNameGeneric, RouteRecordRaw, UseLinkReturn } from 'vue-router'
import { RxSvgIcon } from '/@/components/rx-icon/'

const props = defineProps<{
  item: RouteRecordRaw
  collapsed: boolean
}>()
const route = useRoute()
// const themeStore = useThemeStore()
const roxyClawStore = useRoxyClawStore()
const { buyProxy } = useProxy()
const { isZh } = storeToRefs(useSimpleLocale())

const isCollapsed = defineModel('open', { default: false })
const badgeMap = defineModel<Record<NonNullable<RouteRecordNameGeneric>, boolean>>('badgeMap', { default: () => ({}) })

const canOpen = computed(() => props.item.children?.some(n => !n.meta?.hideInMenu))

if (canOpen.value) {
  isCollapsed.value = true
}

function toggle() {
  isCollapsed.value = !isCollapsed.value
}

watchEffect(() => {
  if (route.matched.some(n => n.name === props.item.name)) {
    isCollapsed.value = false
  }
  if (props.collapsed) {
    isCollapsed.value = true
  }
})

function handleClickItem(event: Event, navigate: UseLinkReturn['navigate']) {
  if (props.item.meta?.type === 'button') {
    const menuAction = props.item.meta?.menuAction
    if (menuAction && menuActionHandlers[menuAction]) {
      void menuActionHandlers[menuAction](event)
    }
    else {
      props.item.meta?.onClick?.(event)
    }
  }
  else if (!canOpen.value || props.item.redirect) {
    navigate()
  }

  // if (props.item.meta?.newBadge) {
  //   localStorage.setItem(cacheKey, 'true')
  //   isShowNewBadge.value = false
  // }

  if (badgeMap.value[props.item.name!]) {
    Reflect.set(badgeMap.value, props.item.name!, false)
    localStorage.setItem('badgeMapCache', JSON.stringify(badgeMap.value))
  }
}

function onAsideBuy() {
  buyProxy()
    .then((orderInfo) => {
      emitter.emit('updateShopList', orderInfo?.orderNo)
    })
}
</script>

<template>
  <div class="menu-item-content" :class="{ collapsed }">
    <RouterLink v-slot="{ navigate, href, isActive }" :to="{ name: item.name, params: item.meta?.params, query: { title: item.meta?.title } }" custom>
      <a v-ripple v-tooltip="{ value: item.meta?.title, disabled: !collapsed }" class="menu-item" :href="canOpen || item.meta?.type === 'button' ? undefined : href" :class="{ 'active': isActive, 'roxy-agent': item.meta?.isRoxyAgent, 'roxy-claw': item.meta?.isRoxyClaw }"
         @click.prevent="handleClickItem($event, navigate)"
      >
        <!-- Roxy Claw 菜单样式 -->
        <template v-if="item.meta?.isRoxyClaw">
          <SvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon" :size="18" />
          <!-- <img :src="themeStore.realTheme === 'light'
            ? (isActive
              ? getImage('roxy-claw/menu/sidenav-active.png')
              : getImage('roxy-claw/menu/sidenav-inactive.png'))
            : (isActive
              ? getImage('roxy-claw/menu/sidenav-active.png')
              : getImage('roxy-claw/menu/sidenav-inactive-dark.png'))" class="block w-4.5" draggable="false"
          > -->
          <div class="flex items-center justify-between w-full menu-title">
            <div class="min-w-0" :title="item.meta?.title">
              <span class="roxy-agent-title ellipsis-1">{{ item.meta?.title }}</span>
            </div>

            <svg v-if="roxyClawStore.isEnabled" v-tooltip="{ value: $t('RoxyClaw 已启动') }" class="text-3" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="6" fill="var(--colors-icon-icon-success)" />
              <circle cx="10" cy="10" r="8" stroke="rgba(28, 201, 77, 0.40)" stroke-opacity="0.4" stroke-width="4" />
            </svg>
          </div>
        </template>

        <!-- Roxy Agent 菜单样式 -->
        <template v-else-if="item.meta?.isRoxyAgent">
          <SvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon" :size="18" />
          <div class="flex items-center gap-2 menu-title">
            <span class="roxy-agent-title ellipsis-1">{{ item.meta?.title }}</span>
            <span v-if="item.meta?.showNewBadge" class="new-badge">{{ $t('自动化') }}</span>
          </div>
        </template>

        <!-- 普通菜单样式 -->
        <template v-else>
          <SvgIcon v-if="item.meta?.icon" :name="item.meta?.icon" class="menu-icon rounded-0.75" :size="18" />

          <div class="relative flex items-center gap-1.5 overflow-hidden menu-title" :title="item.meta?.title">
            <span class="min-w-0 ellipsis-1">{{ item.meta?.title }}</span>
            <RxSvgIcon v-if="item.meta?.showNewBadge" class="new-badge-icon" name="base/new_badge" />
            <span v-if="item.meta?.slotName === 'proxy' || item.meta?.showFireBadge" class="inline-flex items-center gap-0.5">
              <SvgIcon name="base/fire" />
              <span v-if="item.meta?.slotName === 'proxy' && isZh" class="color-[#F53838] text-3.25 font-600">特惠</span>
            </span>
          </div>
          <RxButton v-if="item.meta?.slotName === 'proxy' && !collapsed" class="-mx-1.5" icon="base/rx_ic_cart" variant="outlined" severity="secondary" size="xxs" @click="onAsideBuy" />
          <SvgIcon v-if="item.meta?.external && !collapsed" name="base/rx_ic_arrow_top_right" class="menu-icon external" :size="12" />
        </template>

        <!-- <SvgIcon v-if="item.meta?.newBadge && isShowNewBadge" size="25" :name="(item.meta?.newBadge as SvgNames)" /> -->
        <div v-if="badgeMap[item.name!]" class="flex items-center py-1 px-1.5 gap-2 rounded-1 sent">
          <SvgIcon size="12" name="base/rx_ic_gift_2" color="#ffffff" />
          <span class="sent-text">{{ $t('已发放') }}</span>
        </div>
        <SvgIcon v-if="canOpen" :name="isCollapsed ? 'base/rx_ic_plus' : 'base/rx_ic_minus'" class="menu-icon plus" @click.stop="toggle" />
      </a>
    </RouterLink>
  </div>
</template>

<style lang="scss" scoped>
.menu-item-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  align-self: stretch;
  z-index: 1;

  &.collapsed {
    .menu-item {
      justify-content: center;
    }

    .menu-icon.plus {
      display: none;
    }

    .menu-icon.external {
      display: none;
    }

    .menu-title {
      display: none;
    }
  }
}

.menu-item {
  display: flex;
  gap: var(--spacing-xl, 12px);
  color: #575d61;
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  align-items: center;
  align-self: stretch;
  border-radius: 4px;
  cursor: pointer;
  color: var(--colors-text-text-primary, #fafafa);
  transition: all 0.15s ease-in-out;

  .menu-title {
    flex: auto;
    font-size: 14px;
    font-weight: 500;
    line-height: 16px;
    text-overflow: ellipsis;
    line-height: 20px;
  }

  &:hover {
    color: var(--colors-text-text-primary-hover, #fff);
    background: var(--pattern-sidenav-bg-hover, rgba(255, 255, 255, 0.05));
  }

  &.active {
    color: var(--pattern-sidenav-text-active, #3fb6fd);
    background: var(--pattern-sidenav-bg-active, #013d65);
    font-weight: bold;

    .menu-title {
      font-weight: bold;
      color: currentColor;
    }
  }

  &.active.roxy-claw {
    color: var(--pattern-roxyclaw-text, #eb5757);
    background: color-mix(in srgb, var(--pattern-roxyclaw-sidenav, #ff9c7e), transparent 70%);
  }

  &.roxy-claw {
    color: var(--pattern-roxyclaw-text, #eb5757);
  }

  .menu-icon {
    color: currentColor;
  }

  .claw-icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
    margin-left: 4px;
  }
}

.sent {
  background: #d15cec;

  &-text {
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }
}

.roxy-agent-title {
  background: linear-gradient(103.72deg, #3faaf6 10.6%, #f359dc 55.3%, #f28fb0 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: Archivo, sans-serif;
  font-size: 16px;
  font-variation-settings: 'wdth' 100;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.14px;
}

.new-badge-icon {
  display: block;
  width: 25px;
  height: 19px;
  flex: 0 0 25px;
}

.new-badge {
  display: inline-flex;
  width: max-content;
  min-width: 40px;
  height: 15px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 0;
  border-radius: 7.5px;
  background: linear-gradient(113.67deg, #12a3fc 0%, #c36df4 100%);
  color: #fff;
  font-family: 'DingTalk JinBuTi', sans-serif;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  white-space: nowrap;
}
</style>
