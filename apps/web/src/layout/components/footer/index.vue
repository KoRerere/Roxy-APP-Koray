<template>
  <div class="rx-layout-footer" :class="{ collapsed }">
    <TieredMenu :model="items" :pt="{ rootlist: menuCss.rootlist }">
      <template #item="{ item, props }">
        <ShinyButton v-if="item.shiny" class="w-full cursor-pointer rounded" :title="item.label">
          <a v-ripple class="menu-item" :class="{ 'root-menu': item.rootMenu, active: item.routeName === $route.name }" v-bind="props.action">
            <RxSvgIcon class="menu-icon" v-bind="item.iconAttr" :name="item.icon" :size="18" />
            <span v-if="!collapsed || !item.rootMenu" class="ellipsis-1 menu-title" :title="(item.label as string)">
              {{ item.label }}
            </span>
          </a>
        </ShinyButton>
        <a v-else v-ripple class="menu-item" :class="{ 'root-menu': item.rootMenu, active: item.routeName === $route.name }" v-bind="props.action">
          <RxSvgIcon class="menu-icon" v-bind="item.iconAttr" :name="item.icon" :size="18" />
          <span v-if="!collapsed || !item.rootMenu" class="ellipsis-1 menu-title" :title="(item.label as string)">{{ item.label }}</span>
          <component v-if="!collapsed && item.extra" :is="item.extra" />
        </a>
      </template>
    </TieredMenu>
    <PayMetrics v-if="roleStore.isOwner" :collapsed />
    <div v-else-if="!collapsed" class="no-permission">
      <i18n-t :keypath="$t('您在此工作区中拥有{role}访问权限。', { role: '{role}' })">
        <template #role>
          <span class="role-label">
            {{ roleLabelMap[currentWorkspace?.role as keyof typeof roleLabelMap] }}
          </span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<script setup lang="ts">
import PayMetrics from './components/pay-metrics.vue'
import TaskCircle from '/@/views/tutorial/components/task-progress.vue';
import { RxSvgIcon } from "/@/components/rx-icon";
import { $t } from "/@/locales";
import { useWorkspaceStore } from "/@/stores/workspace";
import { useUserStore } from "/@/stores/user";
import { useRoleStore } from "/@/stores/role";
import { getRoleLabelMap } from "/@/enums";

const collapsed = defineModel('collapsed', { default: false })

const router = useRouter()
const roleStore = useRoleStore()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { userPayInfo, userConfig } = storeToRefs(useUserStore())
const roleLabelMap = getRoleLabelMap()
const menuCss = useCssModule('menu')

const items = computed(() => {
  return [
    {
      label: $t('新手教程'),
      icon: 'base/rx_ic_books',
      rootMenu: true,
      routeName: 'tutorial',
      visible: !userPayInfo.value.onboardingTaskStatus?.hideSidebarEntryStatus,
      command: () => {
        router.push({ name: 'tutorial' })
      },
      extra: () => h(TaskCircle, {
        class: 'mx-auto mr-0'
      })
    },
    {
      label: $t('费用中心'),
      icon: 'base/rx_ic_wallet',
      rootMenu: true,
      routeName: 'wallet',
      visible: roleStore.isOwner,
      command: () => {
        router.push({ name: 'wallet' })
      }
    },
    {
      label: $t('推广计划'),
      icon: 'base/rx_ic_coins_hand',
      rootMenu: true,
      routeName: 'referral-program',
      shiny: true,
      command: () => {
        router.push({ name: 'referral-program' })
      }
    },
  ].filter(item => item.visible !== false)
})

</script>

<style lang="scss" module="menu">
.rootlist {

  :global(.p-tieredmenu-item:not(.p-disabled) > .p-tieredmenu-item-content:hover),
  :global(.p-tieredmenu-item.p-focus > .p-tieredmenu-item-content) {
    background: transparent;
  }
}
</style>

<style lang="scss" scoped>
.rx-layout-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);

  &.collapsed {
    .menu-item.root-menu {
      justify-content: center;
    }
  }

  :deep(.p-tieredmenu) {
    border: none;
    min-width: 100%;
    background-color: transparent;

    .p-tieredmenu-root-list {
      padding: 0;
    }
  }

  .menu-item {
    display: flex;
    gap: var(--spacing-xl, 12px);
    color: var(--colors-text-text-primary, #FAFAFA);
    padding: var(--spacing-lg, 9px) var(--spacing-xl, 12px);
    align-items: center;
    align-self: stretch;
    border-radius: 4px;
    word-break: keep-all;
    white-space: nowrap;

    &:hover {
      color: var(--colors-text-text-primary-hover, #FFF);
      background: var(--pattern-sidenav-bg-hover, rgba(255, 255, 255, 0.05));

      .menu-icon {
        color: currentColor;
      }
    }

    &.active {
      color: var(--pattern-sidenav-text-active, #3FB6FD);
      background: var(--pattern-sidenav-bg-active, #013D65);

      .menu-icon {
        color: currentColor;
      }

      .menu-title {
        font-weight: bold;
      }
    }

    .menu-icon {
      transition: color .2s ease-in-out;
    }

    .menu-title {
      position: relative;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-md, 16px);
    }

    .new-badge {
      position: absolute;
      right: -28px;
      top: -8px;
    }
  }

  .no-permission {
    padding: 10px;
    gap: 8px;
    border-radius: 6px;
    background: var(--pattern-sidenav-metrics);
    backdrop-filter: blur(5px);
    color: var(--colors-text-text-inactive, #A3A9AD);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    max-height: 80px;
    overflow: hidden;

    .role-label {
      color: var(--colors-text-text-secondary, #B2B6B8);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;
    }
  }
}
</style>
