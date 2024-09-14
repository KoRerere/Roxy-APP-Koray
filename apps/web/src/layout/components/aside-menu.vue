<script setup lang=ts>
import type { MenuProps } from 'primevue/menu'
import { RxSvgIcon } from '/@/components/rx-icon'
import { menuRoutes } from '/@/router/menu'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const menuRef = useTemplateRef('menu')

const menuItems = computed<MenuProps['model']>(() => {
  return menuRoutes.filter(item => !item.meta?.hideInMenu).map((route) => {
    return {
      label: route.meta?.title,
      icon: route.meta?.icon,
      route: route.name,
      command: handleCommand,
      items: route.children?.filter(item => !item.meta?.hideInMenu).map((child) => {
        return {
          label: child.meta?.title,
          icon: child.meta?.icon,
          route: child.name,
          command: handleCommand,
        }
      }),
    }
  })
})

function clearSubLabelFocus() {
  Array.from(document.querySelectorAll('.p-menu-submenu-label:has(.not-items)')).forEach((el) => {
    el.classList.remove('p-menu-item', 'p-focus')
  })
}

function handleCommand(event) {
  menuRef.value!.focusedOptionIndex = 'xxx'
  clearSubLabelFocus()
}

function toCreateBrowser() {
  router.push({ name: 'browser-create' })
  clearSubLabelFocus()
  menuRef.value!.focusedOptionIndex = 'xxx'
}

function handleNavigate(e: MouseEvent) {
  menuRef.value!.focusedOptionIndex = 'xxx'
  ;(e.target as HTMLDivElement)?.closest('.p-menu-submenu-label')?.classList.add('p-menu-item', 'p-focus')
}
</script>

<template>
  <div class="aside-menu flex flex-col justify-center" :class="{ collapsed }">
    <ry-button :label="collapsed ? '' : 'New profile'" icon="base/rx_ic_browser_add" class="new-profile-btn" @click="toCreateBrowser" />
    <Menu ref="menu" :model="menuItems">
      <template #submenulabel="{ item }">
        <div v-if="!item?.items?.length" class="p-menu-item-content">
          <router-link v-slot="{ href }" :to="{ name: item.route }" custom>
            <a v-ripple :href="href" class="p-menu-item-link not-items" @click="handleNavigate">
              <RxSvgIcon v-if="item.icon" :name="item.icon" size="16" color="#A3A9AD" />
              <span class="menu-title">{{ item.label }}</span>
            </a>
          </router-link>
        </div>
        <template v-else>
          <template v-if="collapsed">
            <div class="line" />
          </template>
          <template v-else>
            {{ item.label }}
          </template>
        </template>
      </template>
      <template #item="{ item, props }">
        <router-link v-slot="{ href }" :to="{ name: item.route }" custom>
          <a v-ripple :href="href" v-bind="props.action">
            <RxSvgIcon v-if="item.icon" :name="item.icon" size="16" color="#A3A9AD" />
            <span class="menu-title">{{ item.label }}</span>
          </a>
        </router-link>
      </template>
    </Menu>
  </div>
</template>

<style lang="scss" scoped>
.aside-menu {
  width: 100%;
  white-space: nowrap;

  .line {
    width: 100%;
    height: 1px;
    background: var(--Colors-Border-border-container, #c7cdd1);
  }

  :deep(.p-menu) {
    border: none;
    background-color: transparent;
    min-width: unset;

    .p-menu-submenu-label {
      color: rgba(4, 33, 68, 0.3);
      font-size: 10px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;

      &:has(.not-items) {
        padding-left: 0;
        padding-right: 0;
      }
    }

    .p-menu-item.p-focus .p-menu-item-content {
      background: var(--Component-Colors-SideNav-link-bg-active, #e4e8eb);

      .svg {
        color: #252a2e;
      }

      .menu-title {
        color: var(--Component-Colors-SideNav-link-text-active, #0e1214);
        font-family: Inter;
        font-size: var(--Font-Size-text-md, 13px);
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
      }
    }
  }

  &.collapsed {
    .new-profile-btn {
      margin-left: -3px;
    }

    :deep(.p-menu) {
      .menu-title {
        display: none;
      }
      .p-menu-item-link,
      .p-menu-list {
        padding-left: 0;
        padding-right: 0;
        justify-content: center;
      }
      .p-menu-submenu-label:not(:has(.not-items)) {
        padding-left: 5px;
        padding-right: 5px;
      }
    }
  }

  .menu-title {
    color: var(--Component-Colors-SideNav-link-text, #575d61);
    font-size: var(--Font-Size-text-md, 13px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
  }
}
</style>
