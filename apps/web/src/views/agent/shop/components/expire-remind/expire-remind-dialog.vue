<script setup lang="ts">
import { API } from '/@/api'
import type { SvgNames } from '/@/components/rx-icon/'
import { BuyProxyListType, ProxyExpireStatus } from '/@/enums'
import { usePermission } from '/@/hooks/usePermission'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useThemeStore } from '/@/stores/theme'
import { useProxy } from '/@/views/agent/hooks'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import RemarkCell from '/@/views/agent/shop/components/remark-cell.vue'
import { buildExpireBadge, buildLocationText, buildRenewalPriceText, countPageAffectedProfiles, readHasBoundProfile } from './display'
import type { ProxyExpireRemindRow } from './types'

interface Props {
  /**
   * 标题中的即将过期数量。
   * 列表尚未返回时用 checkOnly 的 total，避免标题先显示 0。
   */
  ipCount?: number
  /**
   * checkOnly 是否发现已绑定窗口。
   * 列表返回前用它决定标题，避免没绑窗口时先闪成红色风险文案。
   */
  hasBoundProfile?: boolean
}

const { ipCount, hasBoundProfile } = defineProps<Props>()

const emit = defineEmits<{
  close: []
  /** 勾选结果交给外层记下到次日凌晨；取消勾选则清除 */
  dismissToday: [checked: boolean]
  notNow: []
}>()

// 到期文案在 display.ts 中拼装，语言扫描只收集 $t 字面量
void [
  $t('已过期'),
  $t('今天到期'),
  $t('{day} 天后到期', { day: 0 }),
]

/** 与 RyTable 默认页大小对齐；不足一页时不展示分页，避免短列表底下出现空翻页 */
const PAGE_SIZE = 10

const { check } = usePermission()
const canRenew = computed(() => check('Cost_Center_all'))
/** 没费用中心权限时按钮禁用，提示与购买页立即支付一致 */
const renewTooltip = computed(() => {
  return canRenew.value
    ? undefined
    : $t('暂无权限。如需开通，请联系团队拥有者，开通「充值/账单」权限。')
})
const { renewProxy } = useProxy()
const [, onlyErrorToast] = useResponseToast()
const expireTableRef = useTemplateRef<{ refresh: () => Promise<void> }>('expireTable')
const renewing = ref(false)
const dismissInputId = useId()
/** 勾选状态交给外层记下到次日凌晨；取消勾选则清除 */
const dismissToday = ref(false)
const { isDarkTheme } = storeToRefs(useThemeStore())
const total = ref(0)
/** 列表成功返回后的全量临期数。打开时传入的 ipCount 只在首屏请求完成前占位，续费刷新不能被它盖住 */
const listTotal = ref<number | undefined>()
const affectedProfileCount = ref(0)
/** 列表里的绑定结果优先于打开时的 checkOnly，翻页后仍按全量绑定判断标题 */
const boundFromList = ref<boolean | undefined>()
/** 跨页保留已选行，立即续费用这批 ID 去对齐商店里的代理 IP */
const selection = ref<ProxyExpireRemindRow[]>([])

const showPaginator = computed(() => total.value > PAGE_SIZE)

const columns = ref([
  { title: $t('出口 IP'), key: 'outbound', slot: 'outbound' },
  { title: $t('已关联窗口'), key: 'profiles', slot: 'profiles' },
  { title: $t('IP 用途'), key: 'purpose', slot: 'purpose' },
  { title: $t('到期时间'), key: 'expireDate', slot: 'expire' },
  { title: $t('续费价格'), key: 'price', slot: 'price' },
  { title: $t('备注'), key: 'remark', slot: 'remark' },
])

const titleIpCount = computed(() => listTotal.value ?? ipCount ?? 0)

/** 缺字段时先按有绑定展示，等列表确认后再改成只报 IP 数量 */
const hasBoundWindow = computed(() => (boundFromList.value ?? hasBoundProfile) !== false)

const title = computed(() => {
  if (!hasBoundWindow.value) {
    return $t('{count} 个代理 IP 即将过期', { count: titleIpCount.value })
  }
  return $t('{ipCount} 个代理 IP 即将过期，{profileCount} 个窗口面临风险', {
    ipCount: titleIpCount.value,
    profileCount: affectedProfileCount.value,
  })
})

const subtitle = $t('过期的代理 IP 可能影响已关联窗口，请尽快续费。')

let requestSerial = 0

/** 过期响应不再写回，避免慢请求覆盖新页 */
async function tableRequest(params: { page_index?: number, page_size?: number }) {
  const serial = ++requestSerial
  const pageIndex = Number(params.page_index) || 1
  const pageSize = Number(params.page_size) || PAGE_SIZE
  try {
    const { code, data } = await API.proxy.userGetProxyExpiringSoonListList({
      page_index: String(pageIndex),
      page_size: String(pageSize),
    })
    if (serial !== requestSerial) {
      return new Promise(() => { })
    }
    if (code !== 0 || !data) {
      throw new Error(`[ProxyExpireRemind] list request failed: ${code}`)
    }
    const rows = Array.isArray(data.rows) ? data.rows : []
    total.value = Number(data.total) || 0
    listTotal.value = total.value
    const bound = readHasBoundProfile(data.hasBoundProfile)
    if (bound !== undefined) {
      boundFromList.value = bound
    }
    // 接口没有全量窗口数，标题里的窗口数按当前页 profiles 相加
    affectedProfileCount.value = countPageAffectedProfiles(rows)
    return { total: total.value, rows }
  }
  catch (error) {
    if (serial !== requestSerial) {
      return new Promise(() => { })
    }
    console.error('[ProxyExpireRemind] failed to load expiring proxies', error)
    total.value = 0
    affectedProfileCount.value = 0
    return { total: 0, rows: [] }
  }
}

/** 深色优先 sceneIconDark，缺图时回退另一张，避免只下发一张时用途列空白 */
function purposeIcon(row: Pick<ProxyExpireRemindRow, 'sceneIcon' | 'sceneIconDark'>) {
  const icon = isDarkTheme.value ? row.sceneIconDark || row.sceneIcon : row.sceneIcon || row.sceneIconDark
  return icon || ''
}

/** 国旗用购买时的国家码；检测国家和城市只出现在位置文案里 */
function countryIconName(row: ProxyExpireRemindRow): SvgNames {
  const code = (row.country || row.lastCountry).toLocaleUpperCase()
  return (code ? `country-code/${code}` : 'base/rx_ic_earth') as SvgNames
}

/** RelatedProfilesCell 只收展示文案。临期接口给的是窗口对象，不是商店的 bindList */
function profileLabels(row: ProxyExpireRemindRow) {
  return (row.profiles ?? []).flatMap((profile) => {
    if (profile.name) {
      return [profile.name]
    }
    if (profile.sortNum == null) {
      return []
    }
    return [String(profile.sortNum)]
  })
}

function onDismissToday(checked: boolean | undefined) {
  emit('dismissToday', checked === true)
}

function onNotNow() {
  emit('notNow')
}

/** 续费成功后再查一次。已经没有临期 IP 时，提醒弹窗没有继续留着的必要 */
async function closeWhenNoneExpiring() {
  await expireTableRef.value?.refresh()
  if (listTotal.value === 0) {
    emit('close')
  }
}

/**
 * 临期列表没有原价和续费资格。
 * 按勾选 ID 对齐商店里的即将过期行，再走同一套续费弹窗。
 */
async function onRenewNow() {
  const selected = selection.value ?? []
  if (!selected.length || renewing.value || !canRenew.value) {
    return
  }
  renewing.value = true
  const selectedIds = new Set(selected.map(row => String(row.id)))
  try {
    const { code, data, msg } = await API.proxy.userGetProxyListMergedList({
      type: BuyProxyListType.List,
      proxyExpireStatus: ProxyExpireStatus.soon,
      page_index: '1',
      page_size: String(Math.max(total.value, selected.length, 100)),
    } as Parameters<typeof API.proxy.userGetProxyListMergedList>[0] & { proxyExpireStatus: number })
    onlyErrorToast(code, msg)
    if (code !== 0) {
      return
    }
    const renewList = (data?.rows ?? []).filter(item => item.canRenew && selectedIds.has(String(item.id)))
    if (!renewList.length) {
      onlyErrorToast(-1, $t('所选代理 IP 暂不可续费'))
      return
    }
    renewProxy(renewList, () => {
      void closeWhenNoneExpiring()
    })
  }
  catch (error) {
    console.error('[ProxyExpireRemind] failed to open renew dialog', error)
  }
  finally {
    renewing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col w-220">
    <div class="flex items-start gap-2 px-6 pt-5 pb-4">
      <SvgIcon class="mt-0.5 shrink-0" name="base/rx_ic_info" size="20" :color="hasBoundWindow ? 'var(--colors-icon-icon-error)' : 'var(--colors-icon-icon-warning)'" />
      <div class="flex-1 min-w-0">
        <div class="tt-primary text-5 font-600 leading-6">
          {{ title }}
        </div>
        <div class="mt-1 text-3.5 leading-4 tt-tertiary">
          {{ subtitle }}
        </div>
      </div>
      <SvgIcon class="cursor-pointer shrink-0" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="emit('close')" />
    </div>

    <div class="mx-6 h-80 flex flex-col min-h-0">
      <RyTable ref="expireTable" v-model:columns="columns" v-model:selection="selection" class="min-h-0 flex-1" data-key="id" selection-mode="multiple" :multiple-operation="false"
               :show-table-header="false" :show-actions="false" :paginator="showPaginator" :page-rows="PAGE_SIZE" :clear-selection-on-request="false" :table-request="tableRequest"
      >
        <template #table-empty>
          <div class="py-10 text-center tt-tertiary">
            {{ $t('暂无数据') }}
          </div>
        </template>
        <template #outbound="{ data }">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 shrink-0 overflow-hidden rounded-full border border-solid border-[var(--colors-border-border-subtle)]">
              <SvgIcon :name="countryIconName(data)" fallback="base/rx_ic_earth" size="24" />
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <span class="font-500 leading-4 text-[var(--colors-text-text-primary)]">{{ buildLocationText(data) }}</span>
              <span class="leading-4 tt-tertiary">{{ data.lastIp || '--' }}</span>
            </div>
          </div>
        </template>
        <template #profiles="{ data }">
          <RelatedProfilesCell :list="profileLabels(data)" />
        </template>
        <template #purpose="{ data }">
          <div class="flex items-center gap-1.5 min-w-0">
            <img v-if="purposeIcon(data)" class="block w-5 h-5 shrink-0 rounded-1 object-contain" :src="purposeIcon(data)">
            <span class="font-500 leading-4 text-[var(--colors-text-text-primary)]">{{ data.businessUse || '--' }}</span>
          </div>
        </template>
        <template #expire="{ data }">
          <div class="inline-flex items-center gap-2.5">
            <span class="tt-tertiary">{{ data.expireDate }}</span>
            <span v-if="buildExpireBadge(data).tone !== 'plain'" class="h-6 inline-flex items-center px-1.5 rounded-1 text-3 font-500 leading-normal whitespace-nowrap" :class="buildExpireBadge(data).tone === 'error'
              ? 'error'
              : 'warn'"
            >
              {{ buildExpireBadge(data).text }}
            </span>
            <span v-else class="tt-tertiary">{{ buildExpireBadge(data).text }}</span>
          </div>
        </template>
        <template #price="{ data }">
          <template v-if="buildRenewalPriceText(data)">
            <span class="font-500 text-[var(--colors-text-text-primary)]">{{ buildRenewalPriceText(data) }}</span>
            <span class="text-[var(--colors-text-text-inactive)]"> / {{ $t('{day} 天', { day: 30 }) }}</span>
          </template>
          <span v-else class="tt-tertiary">--</span>
        </template>
        <template #remark="{ data }">
          <RemarkCell :remark="data.remark" />
        </template>
      </RyTable>
    </div>

    <div class="flex items-center justify-between gap-4 border-t border-t-[var(--colors-border-border-subtle)] px-6 py-4 mt-2">
      <div class="flex items-center gap-2">
        <RxCheckbox v-model="dismissToday" :input-id="dismissInputId" binary @update:model-value="onDismissToday" />
        <label class="tt-tertiary text-3 leading-4 select-none cursor-pointer" :for="dismissInputId">
          {{ $t('今日不再提醒') }}
        </label>
      </div>
      <div class="flex items-center gap-2">
        <RxButton severity="secondary" outlined :label="$t('暂不处理')" @click="onNotNow" />
        <RxButton v-tooltip.top="renewTooltip" :label="$t('立即续费')" :disabled="!selection?.length || renewing || !canRenew" :loading="renewing" @click="onRenewNow" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-checkbox-box) {
  width: 16px;
  height: 16px;
}

.warn {
  color: var(--colors-text-text-warning, #fd9f12);
  border: 0.5px solid var(--component-alert-announcement-border-warning, #fd9f12);
  background: var(--component-alert-bg-warn, #feeac7);
}

.error {
  color: var(--colors-text-text-error, #f53838);
  border: 0.5px solid var(--component-alert-announcement-border-error, #f98a86);
  background: var(--component-alert-bg-error, #fdd6d3);
}
</style>
