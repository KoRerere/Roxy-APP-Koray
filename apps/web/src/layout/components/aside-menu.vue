<script setup lang=ts>
import type { MenuProps } from 'primevue/menu'
import { ref } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { menuRoutes } from '/@/router/menu'

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
  <div class="card flex justify-center">
    <Menu :model="menuItems">
      <template #item="{ item, props }">
        <router-link v-if="item.route" v-slot="{ href, navigate }" :to="{ name: item.route }" custom>
          <a v-ripple :href="href" v-bind="props.action" @click="navigate">
            <RxSvgIcon v-if="item.icon" :name="item.icon" />
            <span class="ml-2">{{ item.label }}</span>
          </a>
        </router-link>
        <a v-else v-ripple :href="item.url" :target="item.target" v-bind="props.action">
          <RxSvgIcon v-if="item.icon" :name="item.icon" />
          <span class="ml-2">{{ item.label }}</span>
        </a>
      </template>
    </Menu>
  </div>
</template>
