<script lang="ts" setup>
const router = useRouter()
const routeMenu = router.getRoutes().filter(route => route.meta.root)
console.log('🚀 ~ routeMenu:', routeMenu)

const selectedKeys = ref<string[]>([])

function handleClick(_event: any) {
  // console.log('🚀 ~ handleClick ~ event:', event)
}
</script>

<template>
  <a-menu v-model:selectedKeys="selectedKeys" mode="inline" @click="handleClick">
    <template v-for="route in routeMenu" :key="route.name">
      <a-sub-menu v-if="route.children?.length" :key="route.name">
        <template #title>
          <span>
            <span>{{ route.meta.title }}</span>
          </span>
        </template>

        <a-menu-item v-for="child in route.children" :key="child.name">
          <router-link :to="{ name: child.name }">
            <span>{{ child.meta?.title }}</span>
          </router-link>
        </a-menu-item>
      </a-sub-menu>

      <a-menu-item v-else>
        <router-link :to="{ name: route.name }">
          <span>{{ route.meta?.title }}</span>
        </router-link>
      </a-menu-item>
    </template>
  </a-menu>
</template>
