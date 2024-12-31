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
import SettingsPopup from './components/settings-popup.vue'
import { copyText } from '/@/utils'
import { useToast } from 'primevue/usetoast'
import Usage from './components/usage.vue'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { redeemFormSchemas } from './components/schemas'
import { useDialog as useCustomDialog } from "/@/hooks/useDialog"
import RedeemSuccessfully from './components/redeemSuccessfully.vue'

const router = useRouter()
const dialog = useDialog()
const [dialogInstance] = useCustomDialog()
const userStore = useUserStore()
const simpleLocale = useSimpleLocale()
const styles = useCssModule()
const toast = useToast()
const [formDialog] = useFormDialog()

const menuRef = useTemplateRef('menu')

const badgeIcon = computed(() => {
  const { identity } = userStore.userInfo
  if (identity === 'old') {
    return 'referral-program/golden'
  } else if (identity === 'invited') {
    return 'referral-program/diamond'
  }
  return ''
})

const Identity = () => {
  if (!badgeIcon.value) return null

  const { identity } = userStore.userInfo
  if (identity === 'old') {
    return <div class={styles.identity}>
      <RxSvgIcon name={badgeIcon.value} />
      <span class={styles.golden}>{$t('创始')}</span>
    </div>
  } else if (identity === 'invited') {
    return <div class={styles.identity}>
      <RxSvgIcon name={badgeIcon.value} />
      <span class={styles.diamond}>{$t('特邀')}</span>
    </div>
  }
  return null
}

const items = [
  {
    render: () => {
      return (
        <div onClick={copyUserInfo}>
          <div class={styles['user-info']}>
            <div class={styles['user-name']}>{userStore.userInfo.userName}</div>
            <Identity />
          </div>
          <div class={styles['user-email']}>{userStore.userInfo.email}</div>
        </div>
      )
    },
  },
  {
    separator: true,
  },
  {
    render: Usage,
  },
  {
    separator: true,
  },
  {
    label: $t('兑换特权码'),
    icon: 'referral-program/rx_ic_award',
    command: async () => {
      await formDialog.showModal({
        header: $t('兑换特权码'),
        class: 'w-[450px]',
        schemas: redeemFormSchemas,
        formProps: {
          layout: 'vertical',
        },
        okText: $t('兑换'),
        handleOk: async (params: any) => {
          const { code, msg } = await API.base.userWriteInviteCodeCreate(params)
          if (code !== 0) {
            dialogInstance.showModal({
              header: $t('兑换成功'),
              class: 'w-[380px]',
              slots: {
                footer: null,
                default: () => {
                  return <RedeemSuccessfully hide-fn={dialogInstance.handleCancel} />
                },
              },
            })
          } else {
            toast.add({ severity: 'error', summary: $t('Error'), detail: msg })
          }
        },
      })
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
]

function copyUserInfo() {
  copyText(`${userStore.userInfo.userName}\n${userStore.userInfo.email}`)
  toast.add({ severity: 'success', summary: $t('提示'), detail: $t('用户名与邮箱已复制到剪贴板'), life: 2500 })
}

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
  userStore.fetchUserInfo()
}
</script>

<template>
  <div class="settings cursor-pointer" @click="toggle">
    <RxAvatar class="pointer-events-none" :avatar="userStore.userInfo.avatar"
      :name="userStore.userInfo.userName?.slice(0, 2)" :color="userStore.userInfo.avatarColor" :size="20"
      :font-size="12">
      <RxSvgIcon v-if="badgeIcon" :name="badgeIcon" class="absolute right-[-4px] bottom-[-2px]" size="12px" />
    </RxAvatar>
    <span class="username" :class="userStore.userInfo.identity">{{ userStore.userInfo.userName }}</span>
    <RxSvgIcon class="pointer-events-none" name="base/rx_ic_chevron_down" :size="12" />
  </div>

  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <TieredMenu ref="menu" :model="items" popup :pt="{ root: 'w-[240px]' }">
    <template #item="{ item, props, hasSubmenu }">
      <a v-ripple class="flex items-center" v-bind="props.action">
        <component :is="item.render" v-if="item.render" />
        <template v-else>
          <RxSvgIcon :name="(item.icon as SvgNames)" />
          <span class="menu-label">{{ item.label }}</span>
          <RxSvgIcon v-if="hasSubmenu" class="ml-auto" name="base/rx_ic_chevron_right" />
          <RxSvgIcon v-if="simpleLocale.currentLocale === item.locale" class="ml-auto" name="base/rx_ic_check" />
        </template>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss" module>
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

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

.identity {
  display: flex;
  align-items: center;
  gap: 2px;
}

.golden {
  color: #F56200;
  font-family: "DingTalk JinBuTi";
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */
}

.diamond {
  color: var(--Color-blue-300, #12A3FC);
  font-family: "DingTalk JinBuTi";
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */
}
</style>

<style lang="scss" scoped>
.username {
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

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

  &:not(:disabled):hover {
    color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
    background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #f0f3f5);

    svg {
      color: var(--Component-Colors-Buttons-Secondary-text-hover, #343a3d);
    }
  }
}

.old {
  color: #F56200;
}

.invited {
  color: var(--Colors-Text-text-brand, #12A3FC);
}

.menu-label {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
