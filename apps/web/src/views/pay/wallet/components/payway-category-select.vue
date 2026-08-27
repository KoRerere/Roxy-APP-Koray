<script setup lang="ts">
import Popover from 'primevue/popover'
import type { SvgNames } from '/@/components/rx-icon'
import { getImage } from '/@/utils/basic'
import { PAYWAY_ALL_CATEGORY } from './payway-category'
import { useThemeStore } from '/@/stores/theme'

const { categories } = defineProps<{
  /** 接口去重后的 category，不含 All */
  categories: string[]
}>()

/** 货币分类 → 国旗 ISO，EUR 无 EU 资源时走地球兜底 */
const CATEGORY_COUNTRY: Record<string, string> = {
  USD: 'US',
  CNY: 'CN',
  MYR: 'MY',
  PHP: 'PH',
  INR: 'IN',
  PLN: 'PL',
  BRL: 'BR',
  EUR: 'EU',
  RUB: 'RU',
  THB: 'TH',
  VND: 'VN',
}

const { isDarkTheme } = storeToRefs(useThemeStore())
const selectedCategory = defineModel<string>({ default: PAYWAY_ALL_CATEGORY })
const popoverRef = useTemplateRef<{ toggle: (event: Event) => void, hide: () => void }>('popoverRef')

const options = computed(() => {
  return [PAYWAY_ALL_CATEGORY, ...categories].map(value => ({
    value,
    label: value === PAYWAY_ALL_CATEGORY ? $t('全部') : value,
    visual: getCategoryVisual(value),
  }))
})

const triggerLabel = computed(() => {
  return selectedCategory.value === PAYWAY_ALL_CATEGORY ? $t('全部') : selectedCategory.value
})

/** 分类左侧图标：All 无图，Crypto 用比特币标，其余尽量用圆形国旗 */
function getCategoryVisual(category: string) {
  if (category === PAYWAY_ALL_CATEGORY)
    return { kind: 'none' as const }

  if (category === 'Crypto') {
    const bitcoinIcon = isDarkTheme.value
      ? getImage('payments/dark/payment_icon_bitcoin.svg')
      : getImage('payments/light/payment_icon_bitcoin.svg')
    return { kind: 'image' as const, src: bitcoinIcon }
  }

  const country = CATEGORY_COUNTRY[category]
  if (country)
    return { kind: 'flag' as const, name: `country-code/${country}` as SvgNames }

  return { kind: 'icon' as const, name: 'base/rx_ic_earth' as SvgNames }
}

/** 展开/收起分类浮层 */
function toggle(event: Event) {
  popoverRef.value?.toggle(event)
}

/** 选中分类后立刻关掉浮层，避免挡支付方式网格 */
function selectCategory(category: string) {
  selectedCategory.value = category
  popoverRef.value?.hide()
}
</script>

<template>
  <button type="button" class="category-trigger" @click="toggle">
    <span>{{ triggerLabel }}</span>
    <SvgIcon name="base/rx_ic_chevron_down" size="16" color="var(--colors-icon-icon-secondary)" />
  </button>
  <Popover ref="popoverRef" :pt="{ content: { class: 'p-0!' } }">
    <div class="category-menu">
      <div v-for="item in options" :key="item.value" class="category-option" :class="{ active: selectedCategory === item.value }" @click="selectCategory(item.value)">
        <div v-if="item.visual.kind !== 'none'" class="category-option-icon">
          <img v-if="item.visual.kind === 'image'" :src="item.visual.src" alt="">
          <SvgIcon v-else :name="item.visual.name" size="16" />
        </div>
        <span>{{ item.label }}</span>
      </div>
    </div>
  </Popover>
</template>

<style scoped lang="scss">
.category-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.category-menu {
  display: flex;
  width: 120px;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.category-option {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;

  &.active,
  &:hover {
    background: var(--colors-background-bg-brand-subtle, #def3ff);
  }

  [data-theme='dark'] &.active,
  [data-theme='dark'] &:hover {
    background: var(--pattern-pay-gradient-selected-start, #013d65);
  }

  &-icon {
    display: flex;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 50%;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
