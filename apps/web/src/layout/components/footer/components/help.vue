<template>
  <div v-bind="$attrs" @click="toggle">
    <slot />
  </div>
  <TieredMenu ref="menu" :model="items" popup>
    <template #item="{ item, props, }">
      <a v-ripple class="flex items-center" v-bind="props.action">
        <span :class="item.icon" />
        <span class="ml-2">{{ item.label }}</span>
        <Badge v-if="item.badge" class="ml-auto" :value="item.badge" />
        <span v-if="item.shortcut"
          class="ml-auto border border-surface rounded bg-emphasis text-muted-color text-xs p-1">{{ item.shortcut
          }}</span>
      </a>
    </template>
  </TieredMenu>
</template>

<script setup lang="ts">
import { ref } from "vue";

const menu = ref();
const items = ref([
  {
    label: 'File',
    icon: 'pi pi-file',
  },
  {
    label: 'Edit',
    icon: 'pi pi-file-edit',
  },
]);

const toggle = (event: MouseEvent) => {
  menu.value.toggle(event);
};
</script>
