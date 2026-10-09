<script setup lang="ts">
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import TsFormPassword from '/@/views/lab/components/form/m-input-password.vue'
import PlatformIcon from '/@/views/account/list/components/platform-icon.vue'
import InputLabel from '/@/components/ry-form/input-label.vue'
import RxButton from '/@/components/rx-button'
import { useConfirm } from 'primevue/useconfirm'
import { useThemeStore } from '/@/stores/theme'
import { API } from '/@/api'
import { deepClone } from '/@/utils'

defineOptions({ inheritAttrs: false })

const windowPlatformList = defineModel<any[]>('modelValue', { default: () => [] })

const confirm = useConfirm()
const { realTheme } = storeToRefs(useThemeStore())

const platformOptions = ref<{ label: string, value: string, image?: string, darkImage?: string }[]>([])
const loadedAccounts = ref<Record<string, any>[]>([])
const listLoading = ref(false)
/** 避免打开下拉时的并发刷新把较新结果覆盖掉 */
let loadSeq = 0

onMounted(() => {
  void loadPlatformOptions()
  void loadAccountOptions()
})

async function loadPlatformOptions() {
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
  platformOptions.value = (rows ?? []).map(item => ({
    image: item.platformIcon,
    darkImage: item.platformIconDark,
    label: item.platformUrl!,
    value: item.platformUrl!,
  }))
}

/** 已挂到窗口上的账号库 id，下拉里不再重复出现 */
const linkedAccountIds = computed(() => {
  const ids = new Set<string>()
  for (const item of windowPlatformList.value ?? []) {
    if (item?.id != null && item.id !== '' && item.id !== 0 && String(item.id) !== '0') {
      ids.add(String(item.id))
    }
  }
  return ids
})

/** 下拉选项：排除已关联账号 */
const accountOptions = computed(() =>
  loadedAccounts.value.filter(item => !linkedAccountIds.value.has(String(item.id))),
)

/** 从平台 URL 抽出展示用主机名 */
function getPlatformHost(url?: string) {
  if (!url) {
    return ''
  }
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

/** 把账号条目补齐下拉展示与搜索字段 */
function toAccountOption(item: Record<string, any>) {
  const remark = String(item.platformRemarks ?? '').trim()
  const platform = item.platformName || getPlatformHost(item.platformUrl)
  const label = item.platformUrl || platform || '--'
  return {
    ...item,
    image: item.platformIcon,
    darkImage: item.platformIconDark,
    label,
    searchText: [item.platformUserName, item.platformName, item.platformUrl, remark, platform, label].filter(Boolean).join(' '),
  }
}

/** 选项副文案：账号 + 备注，缺哪项就省略哪项 */
function formatAccountMeta(option: Record<string, any>) {
  const account = String(option.platformUserName ?? '').trim()
  const remark = String(option.platformRemarks ?? '').trim()
  return [account, remark].filter(Boolean).join(' · ')
}

/** 拉取账号库列表；打开下拉时刷新，保证新建项能出现 */
async function loadAccountOptions() {
  const seq = ++loadSeq
  listLoading.value = true
  try {
    const { code, data } = await API.platform.userGetPlatformInfoV2List({
      page_index: 1,
      page_size: 200,
    })
    if (seq !== loadSeq || code !== 0) {
      return
    }
    loadedAccounts.value = (data?.rows ?? []).map(item => toAccountOption(item))
  }
  finally {
    if (seq === loadSeq) {
      listLoading.value = false
    }
  }
}

/** 选中已有账号后立刻清空触发器，避免占位文案被账号名顶掉 */
function onSelectExisting(id: string | number | null) {
  if (id == null || id === '') {
    return
  }
  const found = accountOptions.value.find(item => String(item.id) === String(id))
  if (!found) {
    return
  }
  windowPlatformList.value = [...(windowPlatformList.value ?? []), withLinkedSnapshot(found)]
}

/** 关闭下拉并追加一条空白账号表单 */
function onAddNewAccount(close: () => void) {
  close()
  addEmptyAccount()
}

/** 生成列表项稳定 key，避免解关联后重建节点导致失焦 */
function createTempId() {
  return Date.now().toString(32) + Math.random().toString(16).slice(2, 6)
}

/** 从账号字段生成关联快照，用于判断是否相对账号库发生过编辑 */
function createLinkedSnapshot(row: Record<string, any>) {
  return {
    platformUrl: row.platformUrl ?? '',
    platformUserName: row.platformUserName ?? '',
    platformPassword: row.platformPassword ?? '',
    platformEfa: row.platformEfa ?? '',
  }
}

function createEmptyAccount() {
  return {
    _tempId: createTempId(),
    platformUrl: '',
    platformUserName: '',
    platformPassword: '',
    platformEfa: '',
    platformIcon: '',
    platformIconDark: '',
  }
}

function addEmptyAccount() {
  windowPlatformList.value = [...(windowPlatformList.value ?? []), createEmptyAccount()]
}

/**
 * 编辑窗口回填的关联账号只有 id、没有快照；补齐后改字段才能正确脱离 platformUrlIds
 */
function ensureLinkedSnapshots(list: any[] | undefined | null) {
  if (!Array.isArray(list)) {
    return
  }

  for (const item of list) {
    if (!item?.id || item._linkedSnapshot) {
      continue
    }
    item._tempId ??= createTempId()
    item._linkedSnapshot = createLinkedSnapshot(item)
  }
}

/** 选择已有账号时记录快照，并预置稳定 _tempId，避免解关联时 key 变化导致输入失焦 */
function withLinkedSnapshot(row: Record<string, any>) {
  return {
    ...deepClone(toRaw(row)),
    _tempId: createTempId(),
    _linkedSnapshot: createLinkedSnapshot(row),
  }
}

/**
 * 关联账号一旦改动表单字段，就不再走 platformUrlIds，改为新增账号挂载到窗口
 */
function detachIfLinkedAccountEdited(item: any) {
  if (!item?.id || !item._linkedSnapshot) {
    return
  }

  const snap = item._linkedSnapshot
  const changed = item.platformUrl !== snap.platformUrl
    || item.platformUserName !== snap.platformUserName
    || item.platformPassword !== snap.platformPassword
    || item.platformEfa !== snap.platformEfa

  if (!changed) {
    return
  }

  // 只清关联 id，保留既有 _tempId，避免 v-for key 变化重建节点
  delete item.id
  delete item._linkedSnapshot
}

// 编辑回填 / 外部写入关联账号时补快照，保证改字段可解除关联
watch(windowPlatformList, (list) => {
  ensureLinkedSnapshots(list)
}, { immediate: true })

function onPlatformChange(item: any, value: string) {
  const platform = platformOptions.value.find(opt => opt.value === value)
  item.platformUrl = value
  item.platformIcon = platform?.image || ''
  item.platformIconDark = platform?.darkImage || ''
  detachIfLinkedAccountEdited(item)
}

/** 账号/密码/2FA 变更：同步字段并在必要时解除关联 */
function onAccountFieldUpdate(item: any, key: 'platformUserName' | 'platformPassword' | 'platformEfa', value: string) {
  item[key] = value
  detachIfLinkedAccountEdited(item)
}

/** 从表单列表中移除指定账号 */
function doRemoveAccount(item: any) {
  const key = item._tempId || item.id
  windowPlatformList.value = (windowPlatformList.value ?? []).filter(
    (row: any) => (row._tempId || row.id) !== key,
  )
}

/** 平台/账号/密码/2FA 均未填写时视为空账号，可跳过删除确认 */
function isEmptyAccount(item: any) {
  return !item.platformUrl
    && !item.platformUserName
    && !item.platformPassword
    && !item.platformEfa
}

function removeAccount(item: any) {
  if (isEmptyAccount(item)) {
    doRemoveAccount(item)
    return
  }

  confirm.require({
    header: $t('删除账号'),
    message: $t('您确认要删除该账号吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: () => doRemoveAccount(item),
  })
}

function accountKey(item: any, index: number) {
  return item._tempId || item.id || index
}
</script>

<template>
  <div class="w-full flex items-start account-platform">
    <InputLabel class="shrink-0 max-w-25 !min-w-25 text-right" :label="$t('平台账号')" :tooltip="$t('可为窗口绑定多个平台账号')" />
    <div class="min-w-0 flex-1 flex flex-col gap-3">
      <div v-for="(item, index) in windowPlatformList" :key="accountKey(item, index)" class="flex items-center pa-4 gap-4 rounded-2 panel">
        <div class="flex-1 min-w-0 grid gap-x-3 gap-y-3 items-center account-fields">
          <div class="tt-tertiary text-3 text-right">
            {{ $t('平台') }}
          </div>
          <TsFormSelect v-model="item.platformUrl" class="min-w-0" :options="platformOptions" option-value="value" editable :dark-mode="realTheme === 'dark'" :placeholder="$t('请选择或输入平台网址')"
                        :on-change="({ value }: any) => onPlatformChange(item, value)"
          />
          <div class="tt-tertiary text-3 text-right">
            {{ $t('账号') }}
          </div>
          <TsFormInputText :model-value="item.platformUserName" class="min-w-0" :placeholder="$t('请输入账号')"
                           @update:model-value="(value: string) => onAccountFieldUpdate(item, 'platformUserName', value)"
          />
          <div class="tt-tertiary text-3 text-right">
            {{ $t('密码') }}
          </div>
          <TsFormPassword :model-value="item.platformPassword" class="min-w-0" :placeholder="$t('请输入密码')"
                          @update:model-value="(value: string) => onAccountFieldUpdate(item, 'platformPassword', value)"
          />
          <div class="tt-tertiary text-3 text-right">
            2FA
          </div>
          <TsFormInputText :model-value="item.platformEfa" class="min-w-0" :placeholder="$t('请输入2FA')" @update:model-value="(value: string) => onAccountFieldUpdate(item, 'platformEfa', value)" />
        </div>
        <SvgIcon class="mt-2 shrink-0 cursor-pointer" name="base/rx_ic_bin_1" color="var(--colors-icon-icon-tertiary)" @click="removeAccount(item)" />
      </div>
      <div class="flex items-center gap-2">
        <RxButton severity="secondary" outlined icon="base/rx_ic_add_keys" :label="$t('添加账号')" @click="addEmptyAccount" />
        <TsFormSelect :model-value="null" class="flex-1 min-w-0" :options="accountOptions" option-value="id" option-label="label" filter :highlight-on-select="false" :dark-mode="realTheme === 'dark'"
                      :filter-fields="['searchText', 'label', 'platformUserName', 'platformName', 'platformUrl', 'platformRemarks']" :filter-placeholder="$t('搜索账号 / 平台 / 备注')" :placeholder="$t('选择已有账号')"
                      :empty-message="listLoading ? $t('加载中...') : $t('暂无平台账号')" overlay-class="account-picker-panel" scroll-height="20rem" @before-show="loadAccountOptions"
                      @update:model-value="onSelectExisting"
        >
          <template #option="{ option }">
            <div class="account-option">
              <PlatformIcon v-if="option.platformIcon" class="account-option__icon" :platform-icon="option.platformIcon" :platform-icon-dark="option.platformIconDark" />
              <SvgIcon v-else class="account-option__icon" name="base/rx_ic_user_key" :size="16" color="var(--colors-icon-icon-tertiary)" />
              <div class="account-option__body">
                <div class="account-option__title">
                  {{ option.label }}
                </div>
                <div v-if="formatAccountMeta(option)" class="account-option__meta">
                  {{ formatAccountMeta(option) }}
                </div>
              </div>
            </div>
          </template>
          <template #footer="{ close }">
            <div class="pa-1">
              <RxButton class="w-full" text icon="base/rx_ic_add_keys" :label="$t('添加账号')" @click="onAddNewAccount(close)" />
            </div>
          </template>
        </TsFormSelect>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.panel {
  background: var(--colors-background-bg-block);
  box-shadow: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
}

.account-fields {
  grid-template-columns: max-content 1fr;
}

.account-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.account-option__icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  object-fit: contain;
}

.account-option__body {
  flex: 1;
  min-width: 0;
}

.account-option__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--colors-text-text-primary, #171c1f);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.account-option__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--colors-text-text-tertiary, #8b9498);
  font-size: 12px;
  line-height: 16px;
}
</style>

<style lang="scss">
.account-picker-panel {
  .m-input-select-option {
    align-items: flex-start;
  }
}
</style>
