<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import ryButton from '/@/components/ry-button'
import accountList from '/@/views/browser/components/drawers/account-list.vue'
import accountCreate from '/@/views/browser/components/drawers/account-create.vue'

const selectList = reactive([
  {
    id: 1,
    area: 'mdi mdi-web',
    web: 'http://www.xxx.com',
    email: 'asdasdad@xx.com',
  },
  {
    id: 2,
    area: 'mdi mdi-web',
    web: 'http://www.xxx.com',
    email: 'asdasdad@xx.com',
  },
])

const drawer = reactive({
  visible: false,
  type: 'create',
})

function toggleDrawer(type: 'create' | 'list') {
  drawer.visible = true
  drawer.type = type
}

function deleteAccount(_item: any) {
  const index = selectList.findIndex(item => item.id === _item.id)
  selectList.splice(index, 1)
}

function confirm(_data: any) {
  selectList.push({
    id: new Date().getTime(),
    area: 'mdi mdi-web',
    web: 'http://www.xxx.com',
    email: 'asdasdad@xx.com',
  })
}
</script>

<template>
  <div>
    <div class="button-group">
      <ry-button size="small" severity="secondary" icon="mdi mdi-swap-horizontal" label="Select"
        @click="toggleDrawer('list')" />
      <ry-button size="small" severity="secondary" icon="mdi mdi-plus" label="Add account"
        @click="toggleDrawer('create')" />
    </div>

    <div v-for="(item, index) in selectList" :key="index" class="card-list">
      <rx-card class="card-list-item" @close="deleteAccount(item)">
        <div class="card-list-item-account">
          <span :class="item.area" />
        </div>
        <div class="card-list-item-info">
          <div>{{ item.web }}</div>
          <div>{{ item.email }} </div>
        </div>
      </rx-card>
    </div>

    <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[50%]"
      :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <accountList v-if="drawer.type === 'list'" :close-drawer="closeCallback" />
        <accountCreate v-if="drawer.type === 'create'" :close-drawer="closeCallback" @confirm="confirm" />
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
  margin-bottom: 10px;

  &-item {
    display: flex;
    gap: 8px;

    &-account {
      width: 20px;
      height: 20px;
      font-size: 20px;
      line-height: 1;
    }

    &-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 8px;
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: 20px;
    }
  }
}
</style>
