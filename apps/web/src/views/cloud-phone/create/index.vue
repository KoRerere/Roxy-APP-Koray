<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import InputLabel from '/@/components/ry-form/input-label.vue'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Popover from 'primevue/popover'
import SplitButton from 'primevue/splitbutton'
import BatchImport from './batch-import.vue'
import BillingDescription from './billing-description.vue'
import DevicePreview from './device-preview.vue'
import PhoneTags from '../components/phone-tags.vue'
import { useCloudPhones } from '../useCloudPhones'
import ProxyInfo from '/@/views/browser/create/components/proxy-info/index.vue'
import type { ProxyInfoItem, ProxyInfoMode } from '/@/views/browser/create/components/proxy-info/types'
import { createTableContext } from '/@/views/browser/create/hooks/useContext'
import ViewsHeader from '/@/components/views-header.vue'
import RxButton from '/@/components/rx-button'
import RxTabs from '/@/components/rx-tabs'
import RxSelectButton from '/@/components/rx-select-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { getDictMap } from '/@/utils/dict'

const { t: $t } = useI18n()

const router = useRouter()
const { addPhone, groups } = useCloudPhones()
const [showToast] = useResponseToast()
const mode = ref('single')
const proxyMode = ref<ProxyInfoMode>('noproxy')
const proxyInfoList = ref<ProxyInfoItem[]>([])
const collapsed = ref(false)
const advanced = ref(false)
const saving = ref(false)
const formError = ref('')
const batchCount = ref(0)
const batchImport = ref<InstanceType<typeof BatchImport>>()
const templateKey = 'roxy_cloud_phone_template'
const notesPopover = ref<InstanceType<typeof Popover>>()
const groupPopover = ref<InstanceType<typeof Popover>>()

createTableContext({
  isBatch: computed(() => mode.value === 'batch'),
  createCount: computed(() => mode.value === 'batch' ? batchCount.value : 1),
})

const form = reactive({
  name: '',
  system: 'Android',
  version: '15',
  billing: 'minute',
  group: '未分组',
  tags: [] as string[],
  notes: '',
  device: {
    location: 'South Korea',
    timezone: 'Asia/Seoul',
    brand: 'Google',
    model: 'Pixel 6',
    language: 'ko-KR',
    phoneNumber: '',
    imei: '',
    mac: '',
  },
})

const tabs = computed(() => [
  { title: $t('单个创建'), value: 'single' },
  { title: $t('批量创建'), value: 'batch' },
])
const billingOptions = computed(() => [
  { label: $t('按分钟'), value: 'minute' },
  { label: $t('包月'), value: 'monthly' },
])
const systemVersionOptions = ref<Record<string, { label: string, value: string }[]>>({
  Android: ['15', '14', '13'].map(value => ({ label: `Android ${value}`, value })),
  iOS: ['26', '18', '17'].map(value => ({ label: `iOS ${value}`, value })),
})
const versions = computed(() => systemVersionOptions.value[form.system] ?? [])
const groupOptions = computed(() => [...new Set(['未分组', ...groups.value.filter(item => item !== 'all')])].map(value => ({
  label: value === '未分组' ? $t('未分组') : value,
  value,
})))
const selectedProxy = computed(() => proxyInfoList.value[0])
const createLabel = computed(() => mode.value === 'batch'
  ? $t('创建 {count} 台云手机', { count: batchCount.value })
  : $t('创建云手机'))
const templateActions = computed(() => [{ label: $t('使用模板'), command: loadTemplate }])

onMounted(async () => {
  try {
    const dictMap = await getDictMap()
    for (const system of ['Android', 'iOS']) {
      const options = dictMap[`osversion_${system.toLowerCase()}`]
        ?.filter(item => system !== 'iOS' || !item.value?.includes('.'))
        .map(({ label, value }) => ({ label: `${system} ${label}`, value }))
      if (options?.length) {
        systemVersionOptions.value[system] = options
      }
    }
    if (!versions.value.some(option => option.value === form.version)) {
      form.version = versions.value[0]?.value ?? ''
    }
  }
  catch {
    // 字典加载失败时保留默认版本选项。
  }
})

watch(() => form.system, (system) => {
  form.version = versions.value[0]?.value ?? ''
  form.device.brand = system === 'Android' ? 'Google' : 'Apple'
  form.device.model = system === 'Android' ? 'Pixel 6' : 'iPhone 16'
}, { flush: 'sync' })
watch([mode, proxyMode], () => {
  formError.value = ''
})

function saveTemplate() {
  try {
    // 模板仅保存设备配置，不保存代理 IP 账号密码。
    localStorage.setItem(templateKey, JSON.stringify({ ...form, device: { ...form.device }, tags: [...form.tags] }))
    showToast(0, $t('模板保存成功'))
  }
  catch {
    showToast(-1, $t('模板保存失败，请检查本地存储空间'))
  }
}

function loadTemplate() {
  try {
    const saved = localStorage.getItem(templateKey)
    if (!saved) {
      showToast(-1, $t('暂无已保存的模板'))
      return
    }
    const data = JSON.parse(saved)
    if (!data || typeof data !== 'object' || !data.device) {
      throw new Error('Invalid template')
    }
    Object.assign(form, { ...data, tags: Array.isArray(data.tags) ? data.tags : [], device: { ...form.device, ...data.device } })
    showToast(0, $t('已应用模板'))
  }
  catch {
    showToast(-1, $t('读取模板失败，请重新保存模板'))
  }
}

async function submit() {
  if (saving.value) {
    return
  }
  formError.value = ''
  if (mode.value === 'batch') {
    saving.value = true
    try {
      await batchImport.value?.create(addPhone, {
        group: form.group,
        tags: [...form.tags],
        notes: form.notes,
        billing: 'minute',
      })
    }
    finally {
      saving.value = false
    }
    return
  }
  // 等待代理面板将最后一次输入同步到草稿。
  await nextTick()
  const proxy = selectedProxy.value
  if (proxyMode.value === 'choose' && (!proxy?.id || String(proxy.id) === '0')) {
    formError.value = $t('请选择已有代理 IP')
    return
  }
  if (proxyMode.value === 'custom' && (!proxy?.host?.trim() || !/^\d+$/.test(String(proxy.port ?? '')) || Number(proxy.port) < 1 || Number(proxy.port) > 65535)) {
    formError.value = $t('请填写有效的代理 IP 主机和端口（1–65535）')
    return
  }
  if (form.device.imei && !/^\d{15}$/.test(form.device.imei)) {
    advanced.value = true
    formError.value = $t('IMEI 应为 15 位数字')
    return
  }
  if (form.device.mac && !/^(?:[\dA-F]{2}:){5}[\dA-F]{2}$/i.test(form.device.mac)) {
    advanced.value = true
    formError.value = $t('请输入有效的 MAC 地址')
    return
  }
  saving.value = true
  try {
    for (const name of [form.name.trim() || $t('未命名云手机')]) {
      addPhone({
        name,
        system: `${form.system} ${form.version}`,
        group: form.group,
        tags: [...form.tags],
        notes: form.notes,
        proxyLocation: [proxy?.lastCountry, proxy?.lastCity].filter(Boolean).join('/') || '--',
        proxyIp: proxy?.lastIp || proxy?.host || '--',
        billing: form.billing as 'minute' | 'monthly',
        proxyInfo: proxyMode.value === 'noproxy'
          ? { proxyMethod: 'noproxy', proxyCategory: 'noproxy', protocol: 'noproxy' }
          : { ...proxy },
        device: { ...form.device },
      })
    }
    showToast(0, $t('创建成功'))
    await router.push({ name: 'cloud-phone-list' })
  }
  catch {
    formError.value = $t('保存失败，请检查本地存储空间后重试')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cloud-phone-create flex h-full min-h-0 w-full flex-col overflow-hidden text-[var(--colors-text-text-primary)]">
    <ViewsHeader show-back :divider="false" :title="$t('创建云手机')" />
    <RxTabs v-model:value="mode" :tabs="tabs" only-tabs class="shrink-0" />
    <div class="flex min-h-0 flex-1 overflow-hidden overflow-x-auto px-16">
      <div class="mx-auto flex h-full min-h-0 w-full gap-8" :class="mode === 'batch' || collapsed ? 'min-w-192 max-w-192' : 'min-w-240 max-w-285'">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <div class="cloud-phone-form-scroll min-h-0 min-w-0 flex-1 overflow-y-auto pb-4">
            <BatchImport v-show="mode === 'batch'" ref="batchImport" @count="batchCount = $event" />
            <div v-show="mode === 'single'">
              <section class="mx-4 mb-2 p-4">
                <div class="mb-4 flex min-h-5 items-center justify-between gap-3">
                  <h2 class="m-0 text-4 font-semibold">
                    {{ $t('云手机设置') }}
                  </h2>
                </div>
                <div class="flex flex-col gap-4">
                  <div class="cloud-phone-field">
                    <InputLabel name="cloud-phone-name" :label="$t('名称')" />
                    <RxInputText id="cloud-phone-name" v-model="form.name" class="min-w-0" icon-field-class="min-w-0 flex-1" :placeholder="$t('未命名云手机')" :maxlength="100" />
                  </div>
                  <ProxyInfo v-model="proxyInfoList" v-model:mode="proxyMode" />
                  <div class="cloud-phone-field">
                    <InputLabel name="cloud-phone-system" :label="$t('系统')" />
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                      <div id="cloud-phone-system" class="flex h-8 w-70 shrink-0 overflow-hidden rounded-1.5 border border-solid border-[var(--colors-border-border-subtle)]" role="group" :aria-label="$t('系统')">
                        <button v-for="system in ['Android', 'iOS']" :key="system" type="button" class="flex flex-1 cursor-pointer items-center justify-center rounded-1.5 border-2 border-solid" :class="form.system === system ? 'border-[#11a3fd] bg-[var(--component-segment-bg-action,#dcf0ff)]' : 'border-transparent bg-transparent'" :aria-label="system" :aria-pressed="form.system === system" @click="form.system = system">
                          <RxSvgIcon :name="system === 'Android' ? 'platforms/rx_os_android' : 'platforms/rx_os_iOS'" :size="20" />
                        </button>
                      </div>
                      <RxInputSelect v-model="form.version" name="cloud-phone-version" :aria-label="$t('版本')" :options="versions" option-value="value" :filter="false" class="!w-auto min-w-0 flex-1" />
                    </div>
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel :label="$t('计费方式')" />
                    <RxSelectButton v-model="form.billing" size="lg" :options="billingOptions" option-label="label" option-value="value" :aria-label="$t('计费方式')" />
                  </div>
                  <div class="cloud-phone-indent">
                    <BillingDescription :monthly="form.billing === 'monthly'" />
                  </div>
                </div>
              </section>
              <section class="mt-1 border-x-0 border-y border-dashed border-[var(--colors-border-border-subtle)]">
                <button type="button" class="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-6 text-left text-4 font-semibold leading-4 text-[var(--colors-text-text-primary)]" :aria-expanded="advanced" aria-controls="cloud-phone-fingerprints" @click="advanced = !advanced">
                  <RxSvgIcon :name="advanced ? 'base/rx_ic_minus' : 'base/rx_ic_plus'" :size="20" class="rounded-1 border border-solid border-[var(--colors-border-border-base)] bg-[var(--colors-background-bg-action)] p-0.5" />
                  {{ $t('高级指纹') }}
                </button>
                <div v-if="advanced" id="cloud-phone-fingerprints" class="flex flex-col gap-4 px-4 pb-5">
                  <div class="cloud-phone-field">
                    <InputLabel name="device-location" :label="$t('位置')" /><RxInputText id="device-location" v-model="form.device.location" class="min-w-0" icon-field-class="min-w-0 flex-1" />
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel name="device-timezone" :label="$t('时区')" /><RxInputSelect v-model="form.device.timezone" name="device-timezone" editable :options="['Asia/Seoul', 'Asia/Hong_Kong', 'Asia/Singapore', 'America/Los_Angeles', 'Europe/London'].map(value => ({ label: value, value }))" option-value="value" :filter="false" class="min-w-0 flex-1" />
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel name="device-language" :label="$t('语言')" /><RxInputSelect v-model="form.device.language" name="device-language" editable :options="['ko-KR', 'en-US', 'zh-CN', 'ja-JP', 'ru-RU'].map(value => ({ label: value, value }))" option-value="value" :filter="false" class="min-w-0 flex-1" />
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel name="device-brand" :label="$t('品牌')" /><RxInputText id="device-brand" v-model="form.device.brand" class="min-w-0" icon-field-class="min-w-0 flex-1" />
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel name="device-model" :label="$t('型号')" /><RxInputText id="device-model" v-model="form.device.model" class="min-w-0" icon-field-class="min-w-0 flex-1" />
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel name="device-number" :label="$t('手机号码')" /><RxInputText id="device-number" v-model="form.device.phoneNumber" :placeholder="$t('自动生成')" class="min-w-0" icon-field-class="min-w-0 flex-1" />
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel name="device-imei" label="IMEI" /><RxInputText id="device-imei" v-model="form.device.imei" :maxlength="15" :placeholder="$t('自动生成')" class="min-w-0" icon-field-class="min-w-0 flex-1" />
                  </div>
                  <div class="cloud-phone-field">
                    <InputLabel name="device-mac" label="MAC" /><RxInputText id="device-mac" v-model="form.device.mac" :maxlength="17" :placeholder="$t('自动生成')" class="min-w-0" icon-field-class="min-w-0 flex-1" />
                  </div>
                </div>
              </section>
              <p v-if="formError" role="alert" class="mx-4 rounded-1.5 bg-[var(--colors-background-bg-app)] px-3 py-2 text-3 text-[var(--colors-text-text-error,#d92d20)]">
                {{ formError }}
              </p>
            </div>
          </div>
          <footer class="cloud-phone-footer flex min-h-16 shrink-0 items-center justify-end gap-2 border-0 border-t border-solid border-[var(--colors-border-divider)] px-4 py-4">
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <RxButton v-tooltip.top="form.group === '未分组' ? $t('分组') : form.group" severity="secondary" outlined icon="base/rx_ic_stack" :aria-label="$t('分组')" @click="groupPopover?.toggle($event)" />
              <PhoneTags v-model="form.tags" class="shrink-0">
                <template #trigger="{ openMenu }">
                  <RxButton v-tooltip.top="$t('标签')" severity="secondary" outlined icon="base/rx_ic_tag" :aria-label="$t('标签')" :class="{ '!border-[var(--colors-border-border-brand)]': form.tags.length }" @click="openMenu" />
                </template>
              </PhoneTags>
              <RxButton v-tooltip.top="$t('备注')" severity="secondary" outlined icon="base/rx_ic_doc_add" :aria-label="$t('备注')" :class="{ '!border-[var(--colors-border-border-brand)]': form.notes }" @click="notesPopover?.toggle($event)" />
            </div>
            <SplitButton severity="secondary" :label="$t('存为新模板')" :model="templateActions" @click="saveTemplate" />
            <RxButton class="!max-w-none shrink-0" :label="createLabel" :loading="saving" @click="submit" />
          </footer>
        </div>
        <DevicePreview v-if="mode === 'single'" v-model:collapsed="collapsed" :system="form.system" :version="form.version" :device="form.device" />
      </div>
    </div>
    <Popover ref="notesPopover">
      <div class="flex w-72 max-w-[calc(100vw-64px)] flex-col gap-2">
        <label for="phone-notes" class="text-3.5 font-medium">{{ $t('备注') }}</label><Textarea id="phone-notes" v-model="form.notes" :rows="4" :placeholder="$t('请输入备注信息')" />
      </div>
    </Popover>
    <Popover ref="groupPopover">
      <div class="flex w-60 flex-col gap-2">
        <label for="phone-group" class="text-3.5 font-medium">{{ $t('分组') }}</label><Select v-model="form.group" input-id="phone-group" :options="groupOptions" option-label="label" option-value="value" />
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.cloud-phone-form-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.cloud-phone-form-scroll::-webkit-scrollbar {
  display: none;
}

.cloud-phone-field {
  display: flex;
  align-items: center;
  min-width: 0;
}

.cloud-phone-create :deep(.rx-label) {
  min-width: 100px !important;
  max-width: 100px;
  text-align: right;
}

.cloud-phone-indent {
  padding-left: 108px;
}

.cloud-phone-footer :deep(.p-splitbutton .p-button) {
  padding: var(--spacing-md, 6px) 10px;
  font-size: var(--Font-Size-text-sm, 12px);
  line-height: var(--Line-Height-text-lg, 20px);
  border-width: 1px;
}

.cloud-phone-footer :deep(.p-splitbutton-button) {
  border-top-left-radius: var(--radius-md, 6px);
  border-bottom-left-radius: var(--radius-md, 6px);
  border-right-width: 0;
}

.cloud-phone-footer :deep(.p-splitbutton-dropdown) {
  border-top-right-radius: var(--radius-md, 6px);
  border-bottom-right-radius: var(--radius-md, 6px);
  border-left-width: 0;
}

.cloud-phone-footer :deep(.p-button) {
  max-width: 150px;
}

.cloud-phone-footer :deep(.p-button-label) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
