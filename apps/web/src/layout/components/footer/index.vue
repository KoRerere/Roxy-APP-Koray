<template>
  <div class="rx-layout-footer" :class="{ collapsed }">
    <TieredMenu :model="items" appendTo="body">
      <template #item="{ item, props, hasSubmenu }">
        <a v-ripple class="menu-item" :class="{ 'root-menu': item.rootMenu, active: item.routeName === $route.name }"
          v-bind="props.action">
          <RxSvgIcon class="menu-icon" v-bind="item.iconAttr" :name="item.icon" :size="18" />
          <span v-if="!collapsed || !item.rootMenu" class="menu-title">
            {{ item.label }}
            <RxSvgIcon v-if="item.newBadge && isShowNewBadge" :name="item.newBadge" size="24px" class="new-badge" />
          </span>
        </a>
      </template>
    </TieredMenu>
  </div>
  <LiveChat v-show="false">

  </LiveChat>
</template>

<script setup lang="ts">
import { $t } from "/@/locales";
import { RxSvgIcon } from "/@/components/rx-icon";
import { useSimpleLocale } from "/@/stores/locale";
import LiveChat from '/@/components/business/live-chat/index.vue'

const collapsed = defineModel('collapsed', { default: false })

const cacheKey = 'isShowReferralNewBadge'

const isShowNewBadge = ref(!localStorage.getItem(cacheKey))
const { currentLocale } = useSimpleLocale()
const router = useRouter()

const items = [
  {
    label: $t('推广计划'),
    icon: 'base/rc_ic_user_referral',
    rootMenu: true,
    routeName: 'referral-program',
    newBadge: 'base/new_badge',
    command: () => {
      router.push({ name: 'referral-program' })
      localStorage.setItem(cacheKey, 'true')
      isShowNewBadge.value = false
    }
  },
  {
    label: $t('帮助'),
    icon: 'base/rx_ic_chat_question',
    rootMenu: true,
    items: [
      {
        label: $t('说明文档'),
        icon: 'base/rx_ic_books',
        command: () => window.open(`https://faq.roxybrowser.org/${currentLocale.split('-')[0]}`, '_blank')
      },
      {
        label: $t('联系支持'),
        icon: 'base/rx_ic_headphone_2',
        command: () => LiveChatWidget.call('maximize')
      }
    ]
  },
  {
    label: $t('收起'),
    icon: 'base/rx_ic_fold_right',
    rootMenu: true,
    get iconAttr() {
      return {
        class: { 'rotate-180': collapsed.value },
      }
    },
    command() {
      collapsed.value = !collapsed.value
    },
  },
]
</script>

<style lang="scss" scoped>
.rx-layout-footer {
  width: 100%;

  &.collapsed {
    .menu-item.root-menu {
      justify-content: center;
    }
  }

  :deep(.p-tieredmenu) {
    border: none;
    min-width: 100%;
    background-color: transparent;

    .p-tieredmenu-root-list {
      padding: 0;
    }
  }

  .menu-item {
    display: flex;
    gap: var(--spacing-xl, 12px);
    color: var(--Component-Colors-SideNav-link-text, #575D61);
    padding: var(--spacing-lg, 9px) var(--spacing-xl, 12px);
    align-items: center;
    align-self: stretch;
    border-radius: 4px;
    word-break: keep-all;
    white-space: nowrap;

    &:hover {
      color: var(--Component-Colors-SideNav-link-text-hover, #171c1f);
      background: var(--Component-Colors-SideNav-link-bg-hover, #f0f3f5);

      .menu-icon {
        color: currentColor;
      }
    }

    &.active {
      color: #0085EB;
      background: #D6ECFA;

      .menu-icon {
        color: currentColor;
      }

      .menu-title {
        font-weight: bold;
        color: currentColor;
      }
    }

    .menu-icon {
      transition: color .2s ease-in-out;
    }

    .menu-title {
      position: relative;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-md, 16px);
      color: var(--Component-Colors-SideNav-link-text, #252A2E);
    }

    .new-badge {
      position: absolute;
      right: -28px;
      top: -8px;
    }
  }
}
</style>
