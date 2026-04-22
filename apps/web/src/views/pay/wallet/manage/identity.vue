<script setup lang="ts">
import { PayIdentity } from '/@/enums/pay'
import { useUserStore } from '/@/stores/user'

const { userPayInfo, identityInfo } = storeToRefs(useUserStore())

const isVip = computed(() => [PayIdentity.old, PayIdentity.invited].includes(identityInfo.value.identity))
const isCustomDiscount = computed(() => userPayInfo.value.discount > 15)
const discountKeyPath = computed(() => {
  if (identityInfo.value.identity === PayIdentity.old || identityInfo.value.identity === PayIdentity.invited) {
    return $t('窗口计划、会员、工作区：享 {profile} 折扣，代理：享 {proxy} 折扣', { profile: '{profile}', proxy: '{proxy}' })
  }

  if (isCustomDiscount.value) {
    return $t('永久享受窗口计划、会员、工作区：{profile} 折扣，代理 IP ：{proxy} 折扣', { profile: '{profile}', proxy: '{proxy}' })
  }

  return ''
})
</script>

<template>
  <div v-if="userPayInfo.discount || userPayInfo.proxyDiscount" class="flex items-center gap-3">
    <template v-if="isCustomDiscount">
      <div v-if="isVip" class="flex items-center gap-0.5">
        <SvgIcon v-if="identityInfo.icon" :name="(identityInfo.icon as any)" />
        <div class="identity-label">
          {{ identityInfo.text }}
        </div>
      </div>
      <i18n-t v-if="discountKeyPath" class="identity-value" tag="div" scope="global" :keypath="discountKeyPath">
        <template #profile>
          <span class="identity-discount">{{ $t('{value}%', { value: userPayInfo.discount }) }}</span>
        </template>
        <template #proxy>
          <span class="identity-discount">{{ $t('{value}%', { value: userPayInfo.proxyDiscount }) }}</span>
        </template>
      </i18n-t>
    </template>
    <i18n-t v-else class="identity-value" tag="div" scope="global"
            :keypath="$t('您的账号在 Roxy 中永久享受 {discount} 消费折扣。', { discount: '{discount}' })"
    >
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
