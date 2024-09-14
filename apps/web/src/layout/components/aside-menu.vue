<script setup lang=ts>
import type { MenuProps } from 'primevue/menu'
import { RxSvgIcon } from '/@/components/rx-icon'
import { menuRoutes } from '/@/router/menu'

defineProps({
  collapsed: Boolean,
})

const router = useRouter()

const menuItems = computed<MenuProps['model']>(() => {
  return menuRoutes.filter(item => !item.meta?.hideInMenu).map((route) => {
    return {
      label: route.meta?.title,
      icon: route.meta?.icon,
      route: route.name,
      items: route.children?.filter(item => !item.meta?.hideInMenu).map((child) => {
        return {
          label: child.meta?.title,
          icon: child.meta?.icon,
          route: child.name,
        }
      }),
    }
  })
})
</script>

<template>
  <div class="aside-menu flex flex-col justify-center">
    <ry-button class="!w-full" icon="base/rx_ic_browser_add" @click="router.push({ name: 'browser-create' })">
      New profile
    </ry-button>
    <Menu :model="menuItems">
      <template #submenulabel="{ item }">
        <div v-if="!item?.items?.length" class="p-menu-item-content">
          <router-link v-slot="{ href, navigate }" :to="{ name: item.route }" custom>
            <a v-ripple :href="href" class="p-menu-item-link not-items" @click="navigate">
              <RxSvgIcon v-if="item.icon" :name="item.icon" size="16" color="#A3A9AD" />
              <span v-if="!collapsed" class="menu-title">{{ item.label }}</span>
            </a>
          </router-link>
        </div>
        <template v-else>
          {{ item.label }}
        </template>
      </template>
      <template #item="{ item, props }">
        <router-link v-slot="{ href, navigate }" :to="{ name: item.route }" custom>
          <a v-ripple :href="href" v-bind="props.action" @click="navigate">
            <RxSvgIcon v-if="item.icon" :name="item.icon" size="16" color="#A3A9AD" />
            <span v-if="!collapsed" class="menu-title">{{ item.label }}</span>
          </a>
        </router-link>
      </template>
    </Menu>
  </div>
</template>

<style lang="scss" scoped>
.aside-menu {
  :deep(.p-menu) {
    border: none;
    background-color: transparent;
    .p-menu-submenu-label {
      color: rgba(4, 33, 68, 0.3);
      font-size: 10px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;

      &:has(.not-items) {
        padding-left: 0;
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

  .menu-title {
    color: var(--Component-Colors-SideNav-link-text, #575d61);
    font-size: var(--Font-Size-text-md, 13px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
  }
}
</style>
