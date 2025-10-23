<script setup lang="ts">
import { PayIdentity } from '/@/enums/pay';
import { useUserStore } from '/@/stores/user';

const { userPayInfo, identityInfo } = storeToRefs(useUserStore())

const isVip = computed(() => [PayIdentity.old, PayIdentity.invited].includes(identityInfo.value.identity))
</script>

<template>
  <div class="flex items-center gap-3">
    <template v-if="isVip">
      <div class="flex items-center gap-0.5">
        <SvgIcon v-if="identityInfo.icon" :name="(identityInfo.icon as any)"></SvgIcon>
        <div class="identity-label">{{ identityInfo.text }}</div>
      </div>
      <i18n-t class="identity-value" tag="div" scope="global" :keypath="$t('永久享受 {profile} 订阅折扣(包含成员和空间), {proxy} 代理 IP 折扣。', { profile: '{profile}', proxy: '{proxy}' })">
        <template #profile>
          <span class="identity-discount">{{ $t('{value}%', { value: userPayInfo.discount }) }}</span>
        </template>
        <template #proxy>
          <span class="identity-discount">{{ $t('{value}%', { value: userPayInfo.proxyDiscount }) }}</span>
        </template>
      </i18n-t>
    </template>
    <i18n-t v-else class="identity-value" tag="div" scope="global" :keypath="$t('您的账号在 Roxy 中永久享受 {discount} 消费折扣。', { discount: '{discount}' })">
      <template #discount>
        <span class="identity-discount">{{ $t('{value}%', { value: userPayInfo.discount }) }}</span>
      </template>
    </i18n-t>
  </div>
</template>

<style lang="scss" scoped>
.identity {
  &-label {
    color: var(--colors-text-text-primary);
    font-family: 'DingTalk JinBuTi';
    font-size: 12px;
    line-height: 16px;
  }

  &-value {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 16px;
  }

  &-discount {
    color: var(--colors-text-text-warning);
  }
}
</style>
