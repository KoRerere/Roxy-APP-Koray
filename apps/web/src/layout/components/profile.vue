<script setup lang="ts">
import { useUserStore } from '/@/stores/user'
import { useToast } from 'primevue/usetoast'

const { clearUserInfo } = useUserStore()
const router = useRouter()
const toast = useToast()
const menu = ref()

const items = ref([

  {
    label: '个人信息',
    icon: 'pi pi-refresh',
    command: () => {
      router.push({ name: 'setting' })
    },
  },
  {
    label: '退出登录',
    icon: 'pi pi-upload',
    command: () => {
      clearUserInfo()
      router.push({ name: 'login' })
      toast.add({ severity: 'success', summary: 'Success', detail: '登录成功', life: 5000 })
    },
  },
])

function toggle(event) {
  menu.value.toggle(event)
}
</script>

<template>
  <Avatar image="https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png" class="mr-2" shape="circle"
    @click="toggle" />
  <Menu id="overlay_menu" ref="menu" :model="items" :popup="true" />
</template>
