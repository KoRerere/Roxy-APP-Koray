<script setup lang="ts">
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { ISO639List } from '/@/constants/iso-639'
import type { SvgNames } from '/@/components/rx-icon'
import { PAGE_LOCALE_LABELS, pageLocale, type PageLocale } from './locale'
import { switchPageLocale } from './switch-locale'

const menuRef = useTemplateRef('menu')

const currentLabel = computed(() => PAGE_LOCALE_LABELS[pageLocale])

const menuItems = computed<MenuItem[]>(() => ISO639List.map(item => ({
  label: item.label,
  icon: item.icon,
  isCheck: () => pageLocale === item.locale,
  command: async () => {
    await switchPageLocale(item.locale as PageLocale)
  },
})))

function toggleMenu(event: MouseEvent) {
  menuRef.value?.toggle(event)
}

async function onMenuCommand(event: Event, item: MenuItem & { isCheck?: () => boolean }) {
  await item.command?.({ originalEvent: event, item })
  menuRef.value?.hide()
}
</script>

<template>
  <div class="page-header__language" @click="toggleMenu">
    <img
      class="page-header__language-icon"
      src="/images/proxy-segment-replace/icon-i18n.svg"
      width="16"
      height="16"
      alt=""
    >
    <span>{{ currentLabel }}</span>
  </div>

  <Menu
    ref="menu"
    :model="menuItems"
    popup
    :pt="{
      root: 'page-header__language-menu !border-0.5 min-w-40',
      list: 'overflow-y-auto max-h-80',
    }"
  >
    <template #item="{ item, props }">
      <a v-ripple class="page-header__language-item" v-bind="props.action" @click.stop="onMenuCommand($event, item)">
        <SvgIcon :name="(item.icon as SvgNames)" :size="16" color="var(--colors-icon-icon-secondary)" />
        <span class="page-header__language-item-label">{{ item.label }}</span>
        <SvgIcon
          v-if="(item as { isCheck?: () => boolean }).isCheck?.()"
          class="page-header__language-item-check"
          name="base/rx_ic_check"
          :size="14"
          color="var(--colors-icon-icon-brand, #0086d9)"
        />
      </a>
    </template>
  </Menu>
</template>

<style lang="scss" scoped>
.page-header__language {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #34393d;
  font-family: Inter, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  border-radius: 6px;
  padding: 4px 6px;
  transition: background-color 0.15s ease;

  &:hover {
    background: rgb(0 0 0 / 5%);
  }
}

.page-header__language-icon {
  flex-shrink: 0;
  display: block;
}

:global(.page-header__language-menu .page-header__language-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
}

.page-header__language-item-label {
  flex: 1;
  color: #111213;
  font-size: 13px;
  line-height: 18px;
}

.page-header__language-item-check {
  margin-left: auto;
  flex-shrink: 0;
}
</style>
