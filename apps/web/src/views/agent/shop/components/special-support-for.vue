<script setup lang="ts">
;

const roxyBrowserProviderFeature = {
  label: $t('特别支持'),
  icons: [
    'rx_accounts_netflix',
    'rx_accounts_hbo',
    'rx_accounts_Disney',
    'rx_accounts_Hulu',
    'rx_accounts_spotify',
    'rx_accounts_apple_tv'
  ].map(n => `websites/${n}`)
}

</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="feature-label">{{ roxyBrowserProviderFeature.label }}: </div>
    <div class="flex items-center gap-2.5">
      <div v-for="icon in roxyBrowserProviderFeature.icons" class="feature-icon">
        <SvgIcon :name="icon" size="14" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.feature-label {
  color: var(--colors-text-text-secondary, #CDCFD0);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

.feature-icon {
  display: flex;
  width: 20px;
  height: 20px;
  padding: 3px;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  border: 1px solid var(--colors-border-border-subtle, #48555B);
}
</style>
