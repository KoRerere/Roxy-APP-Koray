<script setup lang="ts">
import type { UserGetUserInfoListData } from '@roxy/backend-api'
import RxAvatar from '/@/components/rx-avatar'
import LanguageSelect from './LanguageSelect.vue'
import { pageLocale } from './locale'

defineProps<{
  userInfo: UserGetUserInfoListData['data'] | null
}>()

/** 中文用 logo-zh，英文与俄语共用 logo-en */
const brandLogoSrc = computed(() => {
  return pageLocale === 'zh-CN'
    ? '/images/proxy-segment-replace/logo-zh.svg'
    : '/images/proxy-segment-replace/logo-en.svg'
})
</script>

<template>
  <header class="page-header">
    <div class="page-header__inner">
      <img class="page-header__brand-logo" :src="brandLogoSrc" alt="RoxyBrowser">

      <div class="page-header__actions">
        <LanguageSelect />

        <div class="page-header__user">
          <RxAvatar
            :avatar="userInfo?.avatar"
            :name="userInfo?.userName?.slice(0, 2)"
            :color="userInfo?.avatarColor"
            :size="24"
            :font-size="12"
          />
          <span class="page-header__user-name">{{ userInfo?.userName || '—' }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgb(245 251 255 / 88%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.page-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 960px;
  margin: 0 auto;
  padding: 36px 24px 0;
  min-height: 36px;
}

.page-header__brand-logo {
  display: block;
  height: 36px;
  width: auto;
  flex-shrink: 0;
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.page-header__user {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgb(0 0 0 / 8%);
}

.page-header__user-name {
  color: #111213;
  font-family: Inter, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .page-header__inner {
    padding: 24px 16px 12px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .page-header__user-name {
    max-width: 120px;
  }
}
</style>
