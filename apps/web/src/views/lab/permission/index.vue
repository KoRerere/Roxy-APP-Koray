<script setup lang="ts">
defineEmits(['close'])

const list = ref([
  {
    title: 'profile',
    items: [
      {
        name: 'add',
        value: true,
        toggle: true,
      },
      {
        name: 'clear',
        value: false,
        toggle: false,
      },
    ],
  },
  {
    title: 'proxy',
    items: [
      {
        name: 'edit',
        value: true,
        toggle: false,
      },
      {
        name: 'delete',
        value: true,
        toggle: false,
      },
    ],
  },
  {
    title: 'team',
    items: [
      {
        name: 'edit',
        value: true,
        toggle: true,
      },
      {
        name: 'delete',
        value: true,
        toggle: false,
      },
    ],
  },
])

function autoRenewChange(item: any) {
  console.log('🚀 ~ autoRenewChange ~ item:', item)
  return false
}
</script>

<template>
  <div class="w-140 flex flex-col gap-4 pa-6 pt-4">
    <div class="h-9 flex items-center justify-between">
      <div class="title">
        {{ $t('管理权限') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" @click="$emit('close')" />
    </div>

    <div class="rounded-2 overflow-hidden overflow-y-auto content">
      <div v-for="group in list" :key="group.title" class="item">
        <div v-for="(item, index) in group.items" :key="item.name" class="flex items-center justify-between pa-3 pr-6">
          <span class="w-30 title" :class="{ 'opacity-0': index !== 0 }">{{ group.title }}</span>
          <span class="flex-1 name">{{ item.name }}</span>
          <RxToggleSwitch v-if="item.toggle" v-model="item.value" :before-change="() => autoRenewChange(item)" />
          <SvgIcon v-else name="base/rx_ic_check" color="var(--colors-icon-icon-brand)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-overlay);
}

.item {
  border-bottom: 1px solid var(--colors-border-border-inactive);

  &:last-child {
    border-bottom: none;
  }
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
}

.name {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: normal;
}
</style>
