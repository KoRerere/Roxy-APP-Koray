<script setup>
defineProps({
  filter: {
    type: Array,
    default: () => [
      {
        label: 'Search',
        icon: 'mdi mdi-earth',
      },
      {
        label: 'Search',
        icon: 'mdi mdi-earth',
      },
      {
        separator: true,
      },
      {
        label: 'Aaaa',
        icon: 'mdi mdi-earth',
      },
      {
        separator: true,
      },
      {
        label: 'Xxxxx',
        icon: 'mdi mdi-earth',
      },
    ],
  },
})
const menu = ref()

function toggle(event) {
  menu.value.toggle(event)
}
</script>

<template>
  <div class="cursor-pointer add-filter" @click="toggle">
    <span class="mdi mdi-account-alert" />
    <span>Add filters</span>
  </div>

  <TieredMenu id="overlay_tmenu" ref="menu" :model="filter" popup
              :pt="{ separator: 'my-separator', menu: { transition: 'my-menu-transition' } }"
  >
    <template #item="{ item }">
      <div class="cursor-pointer add-filter-item">
        <span :class="item.icon" />
        <span>{{ item.label }}</span>
      </div>
    </template>
  </TieredMenu>
</template>

<style lang="scss">
.add-filter-item {
  display: flex;
  align-items: center;

  padding: 8px var(--spacing-md, 6px) 8px 10px;
  gap: var(--spacing-md, 6px);
  border-radius: var(--radius-sm, 4px);
  background: var(--Colors-Background-bg-body, #fff);
}

.my-menu-transition {
  padding: var(--spacing-md, 6px) var(--spacing-sm, 4px) !important;
}

.my-separator {
  margin: var(--spacing-md, 6px) 0;
}
</style>

<style lang="scss" scoped>
.add-filter {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm, 4px);
  border-radius: var(--radius-sm, 4px);
  background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #f0f3f5);

  color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
  text-align: center;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */
}
</style>
