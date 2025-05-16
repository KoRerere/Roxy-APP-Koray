<script setup lang="ts">
import currency from 'currency.js'
import { useSimpleLocale } from '/@/stores/locale';

interface Props {
  discountAmount: number
}

defineProps<Props>()

const isAuto = defineModel<boolean>('modelValue', { required: false })

const { getOfficialWebsite } = useSimpleLocale()
</script>

<template>
  <div class="select-none">
    <label class="flex items-center gap-2" for="auto">
      <Checkbox inputId="auto" v-model="isAuto" binary />
      <i18n-t tag="div" class="discount" :keypath="$t('允许自动续订 {discount}', { discount: '{discount}' })" scope="global">
        <template #discount>
          <span class="discount-value"> {{ $t('{amount} /月', { amount: currency(discountAmount, { symbol: '-$' }).format() }) }}</span>
        </template>
      </i18n-t>
    </label>
    <i18n-t tag="div" class="mt-2.5 pl-7 terms" :keypath="$t('选择即代表您接受 RoxyBrowser {terms}', { terms: '{terms}' })" scope="global">
      <template #terms>
        <a class="terms-link" :href="getOfficialWebsite('copyright/renewal')" target="_blank">{{ $t('自动续订协议') }}</a>
      </template>
    </i18n-t>
  </div>
</template>


<style scoped lang="scss">
.discount {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 14px;
  line-height: normal;

  &-value {
    color: var(--Color-yellow-300, #FC9D12);
    font-family: "DingTalk JinBuTi", sans-serif;
    font-size: 14px;
    line-height: normal;
  }
}

.terms {
  color: var(--Colors-Text-text-tertiary, #7C8387);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  /* 150% */
  &-link {
    color: var(--Colors-Text-text-brand, #12A3FC);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
