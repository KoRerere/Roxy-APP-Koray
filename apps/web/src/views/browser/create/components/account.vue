<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import ryButton from '/@/components/ry-button'
import accountCreate from '/@/views/account/create'
import accountList from '/@/views/account/list/quick.vue'

const windowPlatformList: any = defineModel('modelValue')

const drawer = reactive({
  visible: false,
  type: 'list',
})

function toggleDrawer(type: 'create' | 'list') {
  drawer.visible = true
  drawer.type = type
}

function deleteAccount(item: any) {
  const index = windowPlatformList.value.findIndex((it: any) => it.name === item.name)
  windowPlatformList.value.splice(index, 1)
}

function confirm(data: any) {
  windowPlatformList.value.push(...([].concat(data)))
}
</script>

<template>
  <div>
    <div class="button-group">
      <ry-button size="small" severity="secondary" icon="base/rx_ic_exchange" label="Select"
        @click="toggleDrawer('list')" />
      <ry-button size="small" severity="secondary" icon="base/rx_ic_plus" label="Add account"
        @click="toggleDrawer('create')" />
    </div>

    <div v-for="(item, index) in windowPlatformList" :key="index" class="card-list">
      <rx-card class="card-list-item" @close="deleteAccount(item)">
        <img class="card-list-item-img" :src="item.platformIcon">
        <div class="card-list-item-nation">
          {{ item.platformUrl }}
        </div>
        <div class="card-list-item-time">
          {{ item.platformName }} {{ item.platformUserName }}
        </div>
      </rx-card>
    </div>

    <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[50%]"
      :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <accountList v-if="drawer.type === 'list'" @close="closeCallback"
          @confirm="(data: any) => { confirm(data); closeCallback() }" />
        <accountCreate v-if="drawer.type === 'create'" @close="closeCallback" @confirm="confirm" />
      </template>
    </Drawer>
  </div>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-none, 0px);
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
}

.card-list {
  display: flex;
  flex-direction: column;
  margin-top: 10px;

  &-item {
    display: grid;
    grid-template-columns: 16px 1fr;
    grid-column-gap: var(--spacing-lg, 8px);
    grid-row-gap: var(--spacing-xs, 4px);

    &-img {
      width: 16px;
      height: 16px;
      grid-row-start: span 2;
    }

    &-nation {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
    }

    &-time {
      color: var(--Colors-Text-text-inactive, #a3a9ad);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px);
    }
  }
}
</style>
