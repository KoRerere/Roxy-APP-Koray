<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import Dialog from 'primevue/dialog'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import RxSelectButton from '/@/components/rx-select-button'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import RxInputMultiselect from '/@/components/ry-form/rx-input-multiselect.vue'
import { APP_VERSIONS_VERIFIED_AT, storeApps } from '../app-store-catalog'
import type { AppCategory, StoreApp } from '../app-store-catalog'
import { useCloudPhones } from '../useCloudPhones'

const { variant = 'default' } = defineProps<{ variant?: 'default' | 'compact' }>()
const emit = defineEmits<{ create: [] }>()
const compact = computed(() => variant === 'compact')

const { t: $t } = useI18n()

const { phones } = useCloudPhones()
const filter = ref<'all' | 'installed'>('all')
const search = ref('')
const category = ref<AppCategory | null>(null)
const selectedVersions = ref<Record<string, string>>(Object.fromEntries(storeApps.map(app => [app.id, app.versions[0]!])))
const installingApp = ref<StoreApp | null>(null)
const installVisible = ref(false)
const targetPhones = ref<string[]>([])
const uploadVisible = ref(false)
const apkInput = ref<HTMLInputElement>()
const apkFile = ref<File | null>(null)
const uploadError = ref('')

const filterOptions = computed(() => [
  { label: $t('全部'), value: 'all' },
  { label: $t('已安装'), value: 'installed' },
])
const categoryOptions = computed(() => [
  { label: $t('社交'), value: 'social' },
  { label: $t('通讯'), value: 'communication' },
  { label: $t('影音娱乐'), value: 'entertainment' },
  { label: $t('效率工具'), value: 'productivity' },
  { label: $t('支付'), value: 'payment' },
])
const filteredApps = computed(() => {
  // 安装记录须由设备服务返回，预览阶段不生成虚假的已安装状态。
  if (filter.value === 'installed') {
    return []
  }
  const query = search.value.trim().toLocaleLowerCase()
  return storeApps.filter(app => (!category.value || app.category === category.value)
    && (!query || `${app.name} ${app.keywords} ${$t(app.description)}`.toLocaleLowerCase().includes(query)))
})
const phoneOptions = computed(() => phones.value.map(phone => ({
  label: `${phone.name} · ${phone.system}`,
  value: phone.id,
})))

function versionOptions(app: StoreApp) {
  return app.versions.map(version => ({ label: `v${version}`, value: version }))
}
function openInstall(app: StoreApp) {
  installingApp.value = app
  targetPhones.value = []
  installVisible.value = true
}
function resetFilters() {
  filter.value = 'all'
  search.value = ''
  category.value = null
}
function openUpload() {
  apkFile.value = null
  uploadError.value = ''
  uploadVisible.value = true
}
function selectApk(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    apkFile.value = null
    uploadError.value = ''
    if (!file.name.toLowerCase().endsWith('.apk') || !file.size) {
      uploadError.value = $t('请选择有效的 APK 文件')
    }
    else {
      apkFile.value = file
    }
  }
  input.value = ''
}
function createPhone() {
  installVisible.value = false
  emit('create')
}
</script>

<template>
  <div :data-testid="compact ? 'app-store2' : 'app-store'" class="flex flex-col overflow-hidden bg-[var(--colors-background-bg-page)] [container-type:inline-size]">
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6" :class="compact ? 'py-4' : 'py-3'">
      <div class="flex flex-wrap items-center gap-3">
        <RxSelectButton v-model="filter" size="xxs" :options="filterOptions" option-label="label" option-value="value" :aria-label="$t('应用安装状态')" />
        <div class="flex flex-wrap items-center gap-1.5">
          <RxInputText
            v-model="search" name="app-store-search" size="xxs" left-icon="base/rx_ic_magnify"
            :placeholder="$t('搜索应用')" :aria-label="$t('搜索应用')" :icon-field-class="compact ? '!w-35' : '!w-44'"
          />
          <RxInputSelect
            v-model="category" name="app-store-category" size="xxs" class="!w-45" :filter="false"
            :options="categoryOptions" option-value="value" show-clear
            :placeholder="$t('选择分组')" :aria-label="$t('应用分组')"
          />
        </div>
      </div>
      <RxButton size="xxs" icon="base/rx_ic_plus" :label="$t('上传应用')" @click="openUpload" />
    </div>

    <div class="min-h-0 flex-1 overflow-auto px-6 pb-6" :class="{ 'pt-2': !compact }">
      <!-- 紧凑版以 280px 为最小列宽自动换行，各列均分剩余空间。 -->
      <div
        v-if="filteredApps.length" class="grid gap-4"
        :class="compact
          ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]'
          : 'grid-cols-2 [@container(900px<=width<1280px)]:grid-cols-3 [@container(min-width:1280px)]:grid-cols-4'"
      >
        <article
          v-for="app in filteredApps" :key="app.id" :aria-label="app.name" data-testid="store-app-card"
          class="flex min-w-0 flex-col rounded-lg border border-solid border-[var(--colors-border-border-subtle)] bg-[var(--colors-background-bg-page)]"
          :class="compact ? 'min-h-38 gap-5 p-4' : 'gap-3 p-5'"
        >
          <div class="flex min-w-0 gap-3" :class="compact ? 'min-h-16.5 items-start' : 'items-center'">
            <img
              :src="app.icon" alt="" :width="compact ? 48 : 52" :height="compact ? 48 : 52"
              class="shrink-0 border border-solid border-[var(--colors-border-border-inactive)] object-cover"
              :class="compact ? 'h-12 w-12 rounded-lg' : 'h-13 w-13 rounded-2.5'"
            >
            <div class="min-w-0 flex-1" :class="{ 'flex flex-col gap-1.5': compact }">
              <h2
                class="m-0 min-w-0 break-words font-medium text-[var(--colors-text-text-primary)]"
                :class="compact ? 'text-4.5 leading-6' : 'text-4 leading-5'"
              >
                {{ app.name }}
              </h2>
              <p v-if="compact" :title="$t(app.description)" class="m-0 min-h-9 line-clamp-2 break-words text-3 leading-4.5 tracking-[0.12px] text-[var(--colors-text-text-tertiary)]">
                {{ $t(app.description) }}
              </p>
            </div>
          </div>
          <p v-if="!compact" class="m-0 min-h-9 text-3 leading-4.5 text-[var(--colors-text-text-tertiary)]">
            {{ $t(app.description) }}
          </p>
          <div class="mt-auto flex min-w-0 items-center justify-end gap-2">
            <RxInputSelect
              v-model="selectedVersions[app.id]" :name="`app-version-${app.id}`" size="sm" class="!w-auto min-w-0 max-w-[calc(100%-80px)]"
              :class="{ 'h-8 [&_.p-select-label]:!py-1.25': compact }"
              :options="versionOptions(app)" option-value="value" :filter="false"
              :title="`v${selectedVersions[app.id]}`" :aria-label="`${app.name} ${$t('应用版本')}`"
            />
            <RxButton size="sm" severity="secondary" variant="outlined" :label="$t('安装')" :aria-label="`${$t('安装')} ${app.name}`" class="shrink-0" :class="{ 'h-8 !py-1.25': compact }" @click="openInstall(app)" />
          </div>
        </article>
      </div>

      <div v-else class="flex min-h-80 flex-col items-center justify-center gap-3 py-12 text-center" role="status">
        <RxSvgIcon :name="filter === 'installed' ? 'base/rx_ic_download' : 'base/rx_ic_magnify'" size="32" color="var(--colors-icon-icon-tertiary)" />
        <h2 class="m-0 text-4 font-semibold text-[var(--colors-text-text-primary)]">
          {{ filter === 'installed' ? $t('暂无安装记录') : $t('未找到匹配的应用') }}
        </h2>
        <p class="m-0 max-w-96 text-3.25 leading-5 text-[var(--colors-text-text-tertiary)]">
          {{ filter === 'installed' ? $t('连接设备安装服务后，可在这里查看已安装应用。') : $t('试试其他关键词，或清除筛选条件。') }}
        </p>
        <RxButton size="sm" severity="secondary" variant="outlined" :label="filter === 'installed' ? $t('浏览全部应用') : $t('清除筛选')" @click="resetFilters" />
      </div>
    </div>

    <Dialog v-model:visible="installVisible" modal :draggable="false" :header="$t('安装应用')" :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }">
      <div v-if="installingApp" class="flex flex-col gap-5">
        <div class="flex items-center gap-3">
          <img :src="installingApp.icon" alt="" width="48" height="48" class="h-12 w-12 shrink-0 rounded-2.5 object-cover">
          <div class="flex min-w-0 flex-col gap-1">
            <span class="text-4 font-medium text-[var(--colors-text-text-primary)]">{{ installingApp.name }}</span>
            <span class="text-3 text-[var(--colors-text-text-tertiary)]">Android</span>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <label :for="`install-version-${installingApp.id}`" class="text-3.25 font-medium text-[var(--colors-text-text-primary)]">{{ $t('应用版本') }}</label>
          <RxInputSelect
            v-model="selectedVersions[installingApp.id]" :name="`install-version-${installingApp.id}`" size="sm"
            :options="versionOptions(installingApp)" option-value="value" :filter="false" :aria-label="$t('应用版本')"
          />
          <a :href="installingApp.sourceUrl" target="_blank" rel="noopener noreferrer" class="w-fit text-3 text-[var(--colors-text-text-link)] hover:underline">
            {{ $t('查看版本来源') }} · {{ APP_VERSIONS_VERIFIED_AT }}
          </a>
        </div>
        <div class="flex flex-col gap-2">
          <label for="app-install-phones" class="text-3.25 font-medium text-[var(--colors-text-text-primary)]">{{ $t('选择云手机') }}</label>
          <RxInputMultiselect
            v-if="phoneOptions.length" v-model="targetPhones" input-id="app-install-phones" size="sm"
            :options="phoneOptions" :placeholder="$t('请选择需要安装的云手机')" :max-selected-labels="2" :aria-label="$t('选择云手机')"
            :selected-items-label="$t('已选择 {count} 台云手机', { count: targetPhones.length })"
          />
          <div v-else class="flex items-center justify-between gap-3 rounded-md border border-solid border-[var(--colors-border-border-inactive)] p-3">
            <span class="text-3 text-[var(--colors-text-text-tertiary)]">{{ $t('暂无云手机') }}</span>
            <RxButton size="xs" severity="secondary" variant="outlined" :label="$t('创建云手机')" @click="createPhone" />
          </div>
        </div>
        <p class="m-0 rounded-md bg-[var(--colors-background-bg-info)] p-3 text-3 leading-5 text-[var(--colors-text-text-secondary)]" role="status">
          {{ $t('当前为界面预览，安装服务尚未接入，不会向设备安装应用。') }}
        </p>
      </div>
      <template #footer>
        <RxButton size="sm" severity="secondary" variant="outlined" :label="$t('取消')" @click="installVisible = false" />
        <RxButton size="sm" :label="$t('安装')" disabled />
      </template>
    </Dialog>

    <Dialog v-model:visible="uploadVisible" modal :draggable="false" :header="$t('上传应用')" :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--colors-border-border-action)] px-4 py-8">
          <RxSvgIcon name="base/rx_ic_attachment" size="28" color="var(--colors-icon-icon-tertiary)" />
          <input ref="apkInput" type="file" accept=".apk" :aria-label="$t('选择 APK 文件')" class="hidden" @change="selectApk">
          <RxButton size="sm" severity="secondary" variant="outlined" :label="apkFile ? $t('重新选择') : $t('选择 APK 文件')" @click="apkInput?.click()" />
          <span class="text-3 text-[var(--colors-text-text-tertiary)]">{{ $t('支持 Android APK 安装包') }}</span>
        </div>
        <div v-if="apkFile" class="flex min-w-0 items-center justify-between gap-3 rounded-md bg-[var(--colors-background-bg-block)] p-3 text-3">
          <span class="min-w-0 break-all text-[var(--colors-text-text-primary)]">{{ apkFile.name }}</span>
          <span class="shrink-0 tabular-nums text-[var(--colors-text-text-tertiary)]">{{ (apkFile.size / 1024 / 1024).toFixed(2) }} MB</span>
        </div>
        <p v-if="uploadError" class="m-0 flex items-center gap-1.5 text-3 text-[var(--colors-text-text-error)]" role="alert">
          <RxSvgIcon name="base/rx_ic_info" />{{ uploadError }}
        </p>
        <p class="m-0 text-3 leading-5 text-[var(--colors-text-text-tertiary)]">
          {{ $t('当前为界面预览，文件仅在本地选择，不会上传或安装。') }}
        </p>
      </div>
      <template #footer>
        <RxButton size="sm" severity="secondary" variant="outlined" :label="$t('取消')" @click="uploadVisible = false" />
        <RxButton size="sm" :label="$t('上传应用')" disabled />
      </template>
    </Dialog>
  </div>
</template>
