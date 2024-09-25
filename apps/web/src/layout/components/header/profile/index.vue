<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import SettingsPopup from './settings-popup.vue'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { useUserStore } from '/@/stores/user'

const { clearUserInfo } = useUserStore()
const router = useRouter()
const toast = useToast()
const dialog = useDialog()

const menuRef = useTemplateRef('menu')
const items = ref([
  {
    label: 'Profiles',
    icon: 'base/rx_ic_user_circle',
    command: () => {
      // router.push({ name: 'profile' })
    },
  },
  {
    label: 'Preferences',
    icon: 'base/rx_ic_slider',
  },
  {
    label: 'Network',
    icon: 'base/rx_ic_wifi',
  },
  {
    label: 'Language',
    icon: 'base/rx_ic_language',
    items: [
      {
        label: '简体中文',
        icon: 'country-code/CN',
      },
      {
        label: 'English',
        icon: 'country-code/US',
      },
    ],
  },
  {
    separator: true,
  },
  {
    label: 'Log out',
    icon: 'base/rx_ic_logout',
    command: () => {
      clearUserInfo()
      router.push({ name: 'login' })
      toast.add({ severity: 'success', summary: 'Success', detail: '退出登录成功', life: 5000 })
    },
  },
])

function openSettings() {
  dialog.open(SettingsPopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      style: {
        width: 'var(--width-1_5xl, 960px)',
        height: '640px',
      },
      pt: { content: '!pa-0 !overflow-y-hidden' },
    },
    data: {
      props: {
        title: 'Add notes to profile',
        content: 'Please add notes down below.',
      },
      onConfirm: async (_formData: any) => {
      },
    },
  })
}

function toggle(event: Event) {
  openSettings()
  // menuRef.value?.toggle(event)
}
</script>

<template>
  <Avatar class="cursor-pointer mr-2" image="https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png"
    shape="circle" @click="toggle" />
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <TieredMenu ref="menu" :model="items" popup>
    <template #item="{ item, props, hasSubmenu }">
      <a v-ripple class="flex items-center" v-bind="props.action">
        <RxSvgIcon :name="(item.icon as SvgNames)" />
        <span class="ml-2">{{ item.label }}</span>
        <RxSvgIcon v-if="hasSubmenu" class="ml-auto" name="base/rx_ic_chevron_right" />
      </a>
    </template>
  </TieredMenu>
</template>
