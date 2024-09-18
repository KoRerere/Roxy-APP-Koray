<script setup lang="ts">
import Network from './network.vue'
import Notification from './notification.vue'
import Profile from './profile.vue'
import ResourceUpdater from './resource-updater.vue'

const selectedCountry = ref({ name: 'Australia', code: 'AU' })
const countries = ref([
  { name: 'Australia', code: 'AU' },
  { name: 'Brazil', code: 'BR' },
  { name: 'China', code: 'CN' },
  { name: 'Egypt', code: 'EG' },
  { name: 'France', code: 'FR' },
  { name: 'Germany', code: 'DE' },
  { name: 'India', code: 'IN' },
  { name: 'Japan', code: 'JP' },
  { name: 'Spain', code: 'ES' },
  { name: 'United States', code: 'US' },
])
</script>

<template>
  <div class="rx-layout-header">
    <div class="workspace">
      <Select v-model="selectedCountry" :options="countries" option-label="name" placeholder="Select a Country" class="workspace-select">
        <template #value="slotProps">
          <img :alt="slotProps.value.label" src="https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png">
          <span class="workspace-name">{{ slotProps.value.name }}</span>
        </template>
        <template #option="slotProps">
          <div class="flex items-center">
            <img :alt="slotProps.option.label" src="https://primefaces.org/cdn/primevue/images/avatar/amyelsner.png" class="mr-2" style="width: 18px">
            <div>{{ slotProps.option.name }}</div>
          </div>
        </template>
      </Select>
    </div>
    <div class="top-bar-items">
      <Network />
      <ResourceUpdater />
      <Notification />
      <Profile />
    </div>
  </div>
</template>

<style lang="scss" scoped>
 .rx-layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl, 12px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-none, 0px);
}

.workspace {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px) var(--spacing-sm, 4px) var(--spacing-sm, 4px);
  align-items: center;
  gap: var(--spacing-md, 6px);

  .workspace-select {
    width: unset;
    border: none;
    background-color: transparent;
    box-shadow: none;

    :deep(.p-select-label) {
      display: flex;
      padding: var(--spacing-sm, 4px) var(--spacing-md, 6px) var(--spacing-sm, 4px) var(--spacing-sm, 4px);
      align-items: center;
      gap: var(--spacing-md, 6px);
      padding-right: 0;
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */

      img {
        display: flex;
        width: 20px;
        height: 20px;
        flex-direction: column;
        justify-content: center;
        flex-shrink: 0;
      }

      .workspace-name {
        color: var(--Colors-Text-text-primary, #171c1f);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
      }
    }
  }
}

.top-bar-items {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl, 12px);
}
</style>
