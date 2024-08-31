<script lang="ts" setup>
const router = useRouter()
const routeMenu = router.getRoutes()

const menuMap = routeMenu.reduce((menuMap, route) => {
  if (route.meta.groupName) {
    if (!menuMap[route.meta.groupName])
      menuMap[route.meta.groupName] = []
    menuMap[route.meta.groupName].push(route)
  }
  return menuMap
}, {})

const groups = Object.entries(menuMap).map(([groupName, value]) => ({
  label: groupName,
  items: value.map(item => ({
    label: item.meta.title,
    icon: item.meta.icon,
    suffixIcon: item.meta.suffixIcon,
    command: () => {
      router.push({ name: item.name })
    },
  })),
}))

const profile = [
  {
    label: '新建窗口',
    command: () => {
      router.push({ name: 'browser-create' })
    },
  },
  {
    label: '窗口列表',
    command: () => {
      router.push({ name: 'browser-list' })
    },
  },
  ...groups,
]

const list = ref(profile)
</script>

<template>
  <Menu :model="list" class="w-full rx-menu">
    <template #start>
      logo
    </template>
    <template #item="{ item, props }">
      <a v-ripple class="flex items-center rx-menu-item" v-bind="props.action">
        <span :class="item.icon" />
        <span>{{ item.label }}</span>
        <span v-if="item.suffixIcon" :class="item.suffixIcon" class="ml-auto" />
      </a>
    </template>
  </Menu>
</template>

<style lang="scss" scoped>
.rx-menu-item {
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  gap: var(--spacing-xl, 12px);

  color: var(--Component-Colors-SideNav-link-text, #575d61);
  font-family: Inter;
  font-size: var(--Font-Size-text-md, 13px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
}
</style>

<style lang="scss">
.rx-menu {
  min-width: auto !important;
  background: none !important;
  border: none !important;
}

.p-menu-list {
  padding: 0 !important;
  gap: 0 !important;
}
</style>
