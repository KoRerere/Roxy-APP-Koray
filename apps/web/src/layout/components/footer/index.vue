<template>
  <div class="rx-layout-footer" :class="{ collapsed }">
    <TieredMenu :model="items" appendTo="body">
      <template #item="{ item, props, hasSubmenu }">
        <a v-ripple class="menu-item" :class="{ 'root-menu': item.rootMenu, active: item.routeName === $route.name }"
          v-bind="props.action">
          <RxSvgIcon class="menu-icon" v-bind="item.iconAttr" :name="item.icon" />
          <span v-if="!collapsed || !item.rootMenu" class="menu-title">{{ item.label }}</span>
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

const { currentLocale } = useSimpleLocale()
const router = useRouter()

const items = [
  {
    label: $t('推广计划'),
    icon: 'base/rc_ic_user_referral',
    rootMenu: true,
    routeName: 'referral-program',
    command: () => router.push({ name: 'referral-program' })
  },
  {
    label: $t('帮助'),
    icon: 'base/rx_ic_chat_question',
    rootMenu: true,
    items: [
      {
        label: $t('帮助与说明文档'),
        icon: 'base/rx_ic_books',
        command: () => window.open(`https://faq.roxybrowser.org/${currentLocale}`, '_blank')
      },
      {
        label: $t('获取技术支持'),
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
      console.trace('collapsed', collapsed.value)
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
    color: var(--Component-Colors-SideNav-link-text, #252a2e);
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
        color: var(--Component-Colors-SideNav-link-icon-hover, #7c8387);
      }
    }

    &.active {
      color: var(--Component-Colors-SideNav-link-text-active, #0e1214);
      background: var(--Component-Colors-SideNav-link-bg-active, #e4e8eb);

      .menu-icon {
        color: currentColor;
      }
    }

    .menu-icon {
      color: var(--Component-Colors-SideNav-link-icon, #a3a9ad);
      transition: color .2s ease-in-out;
    }

    .menu-title {
      font-family: Inter;
      font-size: 13px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-md, 16px);
    }
  }
}
</style>
