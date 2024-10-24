<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import RxAvatar from '/@/components/rx-avatar.vue'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { ISO639List } from '/@/constants/iso-639'
import { $t } from '/@/locales'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { getSettings } from './panel'
import SettingsPopup from './settings-popup.vue'

const router = useRouter()
const dialog = useDialog()
const userStore = useUserStore()
const simpleLocale = useSimpleLocale()

const menuRef = useTemplateRef('menu')
const items = ref([
  ...getSettings().map(item => ({ ...item, command: () => openSettings(item.name) })),
  {
    label: $t('语言'),
    icon: 'base/rx_ic_language',
    items: ISO639List.map((item) => {
      return {
        ...item,
        command: () => {
          simpleLocale.setSimpleLocale(item.locale)
        },
      }
    }),
  },
  {
    separator: true,
  },
  ...(import.meta.env.DEV
    ? [
      {
        label: '图标(仅开发)',
        icon: 'base/rx_ic_outlink',
        command: () => {
          window.open('/figma-icons')
        },
      },
      {
        label: '多语言(仅开发)',
        icon: 'base/rx_ic_outlink',
        command: () => {
          window.open('/__language-localization__')
        },
      },
    ]
    : []),
  {
    label: $t('退出登录'),
    icon: 'base/rx_ic_logout',
    command: () => {
      userStore.clearUserInfo()
      router.push({ name: 'login' })
    },
  },
])

function openSettings(activeKey: string) {
  dialog.open(SettingsPopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      dismissableMask: true,
      style: {
        width: 'var(--width-1_5xl, 960px)',
        height: '640px',
      },
      pt: { content: '!pa-0 !overflow-y-hidden' },
    },
    data: {
      props: {
        activeKey,
      },
    },
  })
}

function toggle(event: Event) {
  menuRef.value?.toggle(event)
}
</script>

<template>
  <RxAvatar class="cursor-pointer mr-2" :avatar="userStore.userInfo.avatar" :name="userStore.userInfo.userName?.slice(0, 2)" :color="userStore.userInfo.avatarColor" :size="28" :font-size="16"
    @click="toggle" />

  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <TieredMenu ref="menu" :model="items" popup>
    <template #item="{ item, props, hasSubmenu }">
      <a v-ripple class="flex items-center" v-bind="props.action">
        <RxSvgIcon :name="(item.icon as SvgNames)" />
        <span class="ml-2">{{ item.label }}</span>
        <RxSvgIcon v-if="hasSubmenu" class="ml-auto" name="base/rx_ic_chevron_right" />
        <RxSvgIcon v-if="simpleLocale.currentLocale === item.locale" class="ml-auto" name="base/rx_ic_check" />
      </a>
    </template>
  </TieredMenu>
</template>
