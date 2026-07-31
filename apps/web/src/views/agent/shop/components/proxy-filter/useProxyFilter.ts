import { ProxyAutoRenewalStatus, ProxyBindStatus, ProxyExpireStatus, ProxyType } from '/@/enums/proxy'

/** 「全部」筛选项的占位值，RadioButton 无法可靠匹配 undefined */
export const PROXY_FILTER_ALL = '__all__' as const

/** 单选项的原始值（不含「全部」与多选数组） */
export type ProxyFilterOptionValue = number | string

/** 单个筛选字段值：单选为标量，「全部」占位，或多选数组 */
export type ProxyFilterFieldValue = ProxyFilterOptionValue | typeof PROXY_FILTER_ALL | ProxyFilterOptionValue[]

export interface ProxyFilterValues {
  proxyExpireStatus?: ProxyFilterFieldValue
  proxyBindStatus?: ProxyFilterFieldValue
  proxyType?: ProxyFilterFieldValue
  proxyAutoRenew?: ProxyFilterFieldValue
}

export interface ProxyFilterOption {
  label: string
  value: ProxyFilterOptionValue | typeof PROXY_FILTER_ALL
}

export interface ProxyFilterGroup {
  key: keyof ProxyFilterValues
  label: string
  options: ProxyFilterOption[]
  /** 是否多选；未设置时回退到 useProxyFilter 的 multiple */
  multiple?: boolean
}

export function createDefaultProxyFilterValues(initial?: Partial<ProxyFilterValues>): ProxyFilterValues {
  return {
    proxyExpireStatus: PROXY_FILTER_ALL,
    proxyBindStatus: PROXY_FILTER_ALL,
    proxyType: PROXY_FILTER_ALL,
    proxyAutoRenew: PROXY_FILTER_ALL,
    ...initial,
  }
}

export function getProxyFilterGroups(): ProxyFilterGroup[] {
  return [
    {
      key: 'proxyExpireStatus',
      label: $t('状态'),
      options: [
        { label: $t('全部'), value: PROXY_FILTER_ALL },
        { label: $t('使用中'), value: ProxyExpireStatus.using },
        { label: $t('即将到期'), value: ProxyExpireStatus.soon },
        { label: $t('已过期'), value: ProxyExpireStatus.expired },
      ],
    },
    {
      key: 'proxyBindStatus',
      label: $t('已关联窗口'),
      options: [
        { label: $t('全部'), value: PROXY_FILTER_ALL },
        { label: $t('已关联'), value: ProxyBindStatus.Bound },
        { label: $t('未关联'), value: ProxyBindStatus.Unbound },
      ],
    },
    {
      key: 'proxyType',
      label: $t('来源'),
      options: [
        { label: $t('全部'), value: PROXY_FILTER_ALL },
        { label: $t('已添加'), value: ProxyType.resource.toString() },
        { label: $t('已购买'), value: ProxyType.buy.toString() },
      ],
    },
    {
      key: 'proxyAutoRenew',
      label: $t('自动续费'),
      options: [
        { label: $t('全部'), value: PROXY_FILTER_ALL },
        { label: $t('已开启'), value: ProxyAutoRenewalStatus.Enabled },
        { label: $t('未开启'), value: ProxyAutoRenewalStatus.Disabled },
      ],
    },
  ]
}

/** 判断两个筛选项值是否相等（兼容 number / string） */
export function isSameProxyFilterOptionValue(a: ProxyFilterOptionValue | typeof PROXY_FILTER_ALL, b: ProxyFilterOptionValue | typeof PROXY_FILTER_ALL) {
  return a === b || String(a) === String(b)
}

/** 将字段值规范为多选数组（「全部」或空视为未选） */
export function normalizeProxyFilterMultiValues(value: ProxyFilterFieldValue | undefined): ProxyFilterOptionValue[] {
  if (value === undefined || value === PROXY_FILTER_ALL)
    return []
  if (Array.isArray(value))
    return value.filter(item => item !== PROXY_FILTER_ALL)
  return [value]
}

/** 判断单个筛选项是否生效 */
export function isProxyFilterActive(value: ProxyFilterFieldValue | undefined) {
  if (value === undefined || value === PROXY_FILTER_ALL)
    return false
  if (Array.isArray(value))
    return value.length > 0
  return true
}

/** 字段值转为 API 参数：多选拼成 v1,v2,v3 */
export function serializeProxyFilterFieldValue(value: ProxyFilterFieldValue): number | string {
  if (Array.isArray(value))
    return value.join(',')
  return value as number | string
}

export function getProxyFilterApiParams(values: ProxyFilterValues) {
  const params: Record<string, number | string> = {}

  if (isProxyFilterActive(values.proxyExpireStatus))
    params.proxyExpireStatus = serializeProxyFilterFieldValue(values.proxyExpireStatus!)
  if (isProxyFilterActive(values.proxyBindStatus))
    params.proxyBindStatus = serializeProxyFilterFieldValue(values.proxyBindStatus!)
  if (isProxyFilterActive(values.proxyType))
    params.proxyType = serializeProxyFilterFieldValue(values.proxyType!)
  if (isProxyFilterActive(values.proxyAutoRenew))
    params.proxyAutoRenew = serializeProxyFilterFieldValue(values.proxyAutoRenew!)

  return params
}

export function hasProxyFilterValues(values: ProxyFilterValues) {
  return Object.values(values).some(value => isProxyFilterActive(value))
}

export function useProxyFilter(options: {
  onApply: () => void
  initialValues?: Partial<ProxyFilterValues>
  filterGroups?: ProxyFilterGroup[]
  /** 全局多选开关；分组上的 multiple 优先 */
  multiple?: boolean
}) {
  const visible = ref(false)
  const applied = ref<ProxyFilterValues>(createDefaultProxyFilterValues(options.initialValues))
  const draft = ref<ProxyFilterValues>(createDefaultProxyFilterValues(applied.value))

  const filterGroups = (options.filterGroups ?? getProxyFilterGroups()).map(group => ({
    ...group,
    multiple: group.multiple ?? options.multiple ?? false,
  }))

  const hasActiveFilters = computed(() => hasProxyFilterValues(applied.value))

  const activeFilterCount = computed(() =>
    Object.values(applied.value).filter(value => isProxyFilterActive(value)).length,
  )

  /** 浅拷贝字段，多选数组单独复制，避免 draft 与 applied 共享引用 */
  function cloneFilterValues(values: ProxyFilterValues): ProxyFilterValues {
    return {
      proxyExpireStatus: Array.isArray(values.proxyExpireStatus) ? [...values.proxyExpireStatus] : values.proxyExpireStatus,
      proxyBindStatus: Array.isArray(values.proxyBindStatus) ? [...values.proxyBindStatus] : values.proxyBindStatus,
      proxyType: Array.isArray(values.proxyType) ? [...values.proxyType] : values.proxyType,
      proxyAutoRenew: Array.isArray(values.proxyAutoRenew) ? [...values.proxyAutoRenew] : values.proxyAutoRenew,
    }
  }

  function openDrawer() {
    draft.value = cloneFilterValues(applied.value)
    visible.value = true
  }

  function closeDrawer() {
    visible.value = false
  }

  function resetDraft() {
    draft.value = createDefaultProxyFilterValues()
  }

  /** 判断草稿中某选项是否选中 */
  function isDraftOptionSelected(key: keyof ProxyFilterValues, optionValue: ProxyFilterOption['value']) {
    const current = draft.value[key]
    if (optionValue === PROXY_FILTER_ALL)
      return !isProxyFilterActive(current)
    if (Array.isArray(current))
      return current.some(item => isSameProxyFilterOptionValue(item, optionValue))
    return isSameProxyFilterOptionValue(current as ProxyFilterOptionValue | typeof PROXY_FILTER_ALL, optionValue)
  }

  /** 更新单个筛选分组的草稿值（单选） */
  function updateDraftField<K extends keyof ProxyFilterValues>(key: K, value: ProxyFilterFieldValue) {
    draft.value = {
      ...draft.value,
      [key]: value,
    }
  }

  /**
   * 切换多选选项：选「全部」清空其它项；选具体项时移除「全部」；取消到空则回「全部」
   */
  function toggleDraftFieldOption(key: keyof ProxyFilterValues, optionValue: ProxyFilterOption['value']) {
    const group = filterGroups.find(item => item.key === key)
    if (!group?.multiple) {
      updateDraftField(key, optionValue)
      return
    }

    if (optionValue === PROXY_FILTER_ALL) {
      updateDraftField(key, PROXY_FILTER_ALL)
      return
    }

    const selected = normalizeProxyFilterMultiValues(draft.value[key])
    const index = selected.findIndex(item => isSameProxyFilterOptionValue(item, optionValue))
    if (index >= 0)
      selected.splice(index, 1)
    else
      selected.push(optionValue)

    updateDraftField(key, selected.length === 0 ? PROXY_FILTER_ALL : selected)
  }

  function apply() {
    applied.value = cloneFilterValues(draft.value)
    visible.value = false
    options.onApply()
  }

  function setApplied(values: Partial<ProxyFilterValues>) {
    applied.value = cloneFilterValues({ ...applied.value, ...values })
    draft.value = cloneFilterValues(applied.value)
  }

  function getApiParams() {
    return getProxyFilterApiParams(applied.value)
  }

  return {
    visible,
    applied,
    draft,
    filterGroups,
    hasActiveFilters,
    activeFilterCount,
    openDrawer,
    closeDrawer,
    resetDraft,
    isDraftOptionSelected,
    updateDraftField,
    toggleDraftFieldOption,
    apply,
    setApplied,
    getApiParams,
  }
}
