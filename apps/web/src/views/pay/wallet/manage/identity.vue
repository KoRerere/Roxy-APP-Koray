<script setup lang="ts">
import { PayIdentity } from '/@/enums/pay'
import { useUserStore } from '/@/stores/user'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'

const { userPayInfo, identityInfo } = storeToRefs(useUserStore())
const billingLabels = useBillingEntityLabels()

const isVip = computed(() => [PayIdentity.old, PayIdentity.invited].includes(identityInfo.value.identity))
const isCustomDiscount = computed(() => userPayInfo.value.discount > 15)
const discountKeyPath = computed(() => {
  if (identityInfo.value.identity === PayIdentity.old || identityInfo.value.identity === PayIdentity.invited) {
    return billingLabels.value.subscribeIdentityDiscount
  }

  if (isCustomDiscount.value) {
    return billingLabels.value.subscribeIdentityDiscountPermanentKeypath
  }

  return ''
})
</script>

<template>
  <div v-if="userPayInfo.discount || userPayInfo.proxyDiscount" class="flex items-center gap-3">
    <template v-if="isCustomDiscount">
      <div v-if="isVip" class="shrink-0 flex items-center gap-0.5">
        <SvgIcon v-if="identityInfo.icon" :name="(identityInfo.icon as any)" />
        <div class="tt-primary text-3 leading-4 font-[DingTalk_JinBuTi]">
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
        <template #points>
          <i18n-t v-if="userPayInfo.pointsDiscount > 0" :keypath="$t('，AI Agent 积分 {discount} 折扣', { discount: '{discount}' })">
            <template #discount>
              <span class="identity-discount">{{ $t('{value}%', { value: userPayInfo.pointsDiscount }) }}</span>
            </template>
          </i18n-t>
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
