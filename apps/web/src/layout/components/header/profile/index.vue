<script setup lang="tsx">
import { useDialog } from 'primevue/usedialog'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import RxAvatar from '/@/components/rx-avatar'
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
const styles = useCssModule()

const menuRef = useTemplateRef('menu')

const items = ref([
  {
    render: () => {
      return (
        <div>
          <div class={styles['user-name']}>{userStore.userInfo.userName}</div>
          <div class={styles['user-email']}>{userStore.userInfo.email}</div>
        </div>
      )
    },
  },
  {
    separator: true,
  },
  ...getSettings().map(item => ({ ...item, command: () => openSettings(item.name) })),
  {
    label: $t('语言'),
    icon: 'base/rx_ic_language',
    items: ISO639List.map((item) => {
      return {
        ...item,
        command: async () => {
          await API.base.userSetUserConfigCreate({ language: item.locale })
          simpleLocale.setSimpleLocale(item.locale)
          electronAPI.send('app:saveSoftConfig', { language: item.locale })
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
      {
        label: '实验室(仅开发)',
        icon: 'base/rx_ic_doc_api',
        command: () => {
          router.push({ name: 'cattle-slaughter' })
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
  <div class="settings cursor-pointer" @click="toggle">
    <RxAvatar class="pointer-events-none" :avatar="userStore.userInfo.avatar" :name="userStore.userInfo.userName?.slice(0, 2)" :color="userStore.userInfo.avatarColor" :size="20" :font-size="12" />
    <RxSvgIcon class="pointer-events-none" name="base/rx_ic_chevron_down" :size="12" />
  </div>

  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <TieredMenu ref="menu" :model="items" popup>
    <template #item="{ item, props, hasSubmenu }">
      <a v-ripple class="flex items-center" v-bind="props.action">
        <component :is="item.render" v-if="item.render" />
        <template v-else>
          <RxSvgIcon :name="(item.icon as SvgNames)" />
          <span class="ml-2">{{ item.label }}</span>
          <RxSvgIcon v-if="hasSubmenu" class="ml-auto" name="base/rx_ic_chevron_right" />
          <RxSvgIcon v-if="simpleLocale.currentLocale === item.locale" class="ml-auto" name="base/rx_ic_check" />
        </template>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss" module>
.user-name {
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.user-email {
  margin-top: var(--spacing-sm, 4px);
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>

<style lang="scss" scoped>
.settings {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  align-items: center;
  gap: var(--spacing-md, 6px);
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
