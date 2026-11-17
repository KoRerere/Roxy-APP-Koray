<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import BillingDescription from './billing-description.vue'
import CustomEmpty from '/@/components/custom-empty.vue'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import RyTable from '/@/components/ry-table'
import { parseProxyUrl } from '/@/utils'
import type { CloudPhoneItem } from '../useCloudPhones'

const emit = defineEmits<{ count: [count: number] }>()

const { t: $t } = useI18n()

interface ImportRow {
  key: number
  name: string
  system: string
  proxy: string
  username: string
  password: string
  group: string
  id: string
  status: 'ready' | 'success' | 'failed'
  error: string
}

const rows = ref<ImportRow[]>([])
const dragging = ref(false)
const loading = ref(false)
const error = ref('')
const filename = ref('')
const fileInput = ref<HTMLInputElement>()
const headers = ['name', 'system', 'proxy', 'username', 'password', 'group']
const columns = computed(() => [
  { key: 'key', title: $t('序号'), style: { width: '88px' } },
  { key: 'id', title: $t('环境 ID'), slot: 'id', style: { width: '128px' } },
  { key: 'name', title: $t('云手机名称'), slot: 'name', style: { width: '128px' } },
  { key: 'status', title: $t('创建结果'), slot: 'status', style: { width: '120px' } },
  { key: 'error', title: $t('失败原因'), slot: 'error', style: { width: '160px' } },
  { key: 'actions', title: $t('操作'), slot: 'actions', style: { width: '80px' } },
])

function parseLine(line: string) {
  const delimiter = line.includes('\t') ? '\t' : ','
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"'
        i++
      }
      else {
        quoted = !quoted
      }
    }
    else if (char === delimiter && !quoted) {
      values.push(value.trim())
      value = ''
    }
    else {
      value += char
    }
  }
  values.push(value.trim())
  return values
}

async function readFile(file?: File) {
  if (!file || loading.value) {
    return
  }
  error.value = ''
  if (!/\.(?:xlsx|txt|csv)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
    error.value = $t('请上传不超过 5 MB 的 .xlsx、.txt 或 .csv 文件')
    return
  }
  loading.value = true
  try {
    let records: string[][] = []
    if (/\.xlsx$/i.test(file.name)) {
      const { Workbook } = await import('exceljs')
      const workbook = new Workbook()
      await workbook.xlsx.load(await file.arrayBuffer())
      workbook.worksheets[0]?.eachRow((row) => {
        records.push(headers.map((_, index) => row.getCell(index + 1).text.trim()))
      })
    }
    else {
      records = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(parseLine)
    }
    if (records[0]?.[0]?.toLowerCase() === 'name' || records[0]?.[0] === '云手机名称') {
      records.shift()
    }
    records = records.filter(record => record.some(Boolean))
    if (!records.length || records.length > 100) {
      error.value = $t('文件中应包含 1–100 台云手机配置')
      return
    }
    rows.value = records.map((record, index) => ({
      key: index + 1,
      name: record[0] || '',
      system: record[1] || 'Android 15',
      proxy: record[2] || '',
      username: record[3] || '',
      password: record[4] || '',
      group: record[5] || '',
      id: '',
      status: 'ready',
      error: '',
    }))
    filename.value = file.name
    emit('count', rows.value.length)
  }
  catch {
    error.value = $t('文件读取失败，请使用导入模板检查文件格式')
  }
  finally {
    loading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

function dropFile(event: DragEvent) {
  dragging.value = false
  void readFile(event.dataTransfer?.files[0])
}

async function downloadTemplate() {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet('Cloud Phones')
  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true }
  sheet.columns.forEach((column) => {
    column.width = 24
  })
  const data = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'cloud-phone-import-template.xlsx'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function removeRow(key: number) {
  rows.value = rows.value.filter(row => row.key !== key)
  emit('count', rows.value.filter(row => row.status !== 'success').length)
}

async function create(createPhone: (payload: Partial<CloudPhoneItem>) => CloudPhoneItem, defaults: Partial<CloudPhoneItem>) {
  if (!rows.value.length) {
    error.value = $t('请先上传批量创建文件')
    return
  }
  for (const row of rows.value.filter(item => item.status !== 'success')) {
    row.error = ''
    const proxy = parseProxyUrl(row.proxy)
    if (!row.name || !/^(?:Android (?:13|14|15)|iOS (?:17|18))$/.test(row.system)) {
      row.status = 'failed'
      row.error = $t('请填写名称和有效的系统版本')
      continue
    }
    if (!proxy.host || !/^\d+$/.test(String(proxy.port ?? '')) || Number(proxy.port) < 1 || Number(proxy.port) > 65535) {
      row.status = 'failed'
      row.error = $t('请填写有效的代理 IP 主机和端口（1–65535）')
      continue
    }
    try {
      const phone = createPhone({
        ...defaults,
        name: row.name,
        system: row.system,
        group: row.group || defaults.group,
        proxyIp: proxy.host,
        proxyLocation: '--',
        proxyInfo: { ...proxy, proxyUserName: row.username || proxy.proxyUserName, proxyPassword: row.password || proxy.proxyPassword },
      })
      row.id = phone.id
      row.status = 'success'
    }
    catch {
      row.status = 'failed'
      row.error = $t('保存失败，请检查本地存储空间后重试')
    }
  }
  emit('count', rows.value.filter(row => row.status !== 'success').length)
}

defineExpose({ create })
</script>

<template>
  <div class="px-4 pb-4 pt-4">
    <div class="flex flex-col gap-4">
      <section class="min-w-0 flex-1 px-4 pb-8">
        <div class="rounded-3 border border-solid border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-page)] p-4">
          <div class="flex min-h-69.5 flex-col items-center justify-center gap-4 rounded-2 border border-solid border-transparent bg-[var(--colors-background-bg-block,#f1f5f8)] px-4 py-16 text-center" :class="{ '!border-[#11a3fd]': dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dropFile">
            <RxSvgIcon name="base/rx_ic_doc_fill" :size="48" class="text-[var(--colors-icon-icon-inactive)]" />
            <div class="text-3 leading-4">
              <p class="mb-0.5 mt-0 font-medium">
                {{ filename || $t('选择文件并拖放至此处') }}
              </p><p class="m-0 text-[var(--colors-text-text-tertiary)]">
                {{ $t('上传编辑后的文件，支持 .xlsx、.txt、.csv 格式，最大 5 MB。') }}
              </p>
            </div>
            <RxButton size="sm" severity="secondary" outlined icon="base/rx_ic_export" :label="$t('上传文件')" :loading="loading" @click="fileInput?.click()" />
            <input ref="fileInput" type="file" class="sr-only" accept=".xlsx,.txt,.csv" :aria-label="$t('上传文件')" @change="readFile(($event.target as HTMLInputElement).files?.[0])">
          </div>
        </div>
        <p class="mb-0 mt-3 text-3 leading-4">
          {{ $t('点击下载') }} <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-[var(--colors-text-text-brand)] underline" @click="downloadTemplate">
            {{ $t('云手机导入模板') }}
          </button>. {{ $t('单次最多导入 100 台云手机。') }}
        </p>
        <p v-if="error" role="alert" class="mb-0 text-3 text-[var(--colors-text-text-error,#d92d20)]">
          {{ error }}
        </p>
      </section>
      <BillingDescription class="mx-4" />
    </div>
    <section class="border-0 border-t border-dashed border-[var(--colors-border-border-subtle)] px-4 pt-6">
      <h2 class="mb-2 mt-0 text-4 font-semibold">
        {{ $t('批量上传结果') }}
      </h2>
      <p class="mb-5 mt-0 text-3 leading-4 text-[var(--colors-text-text-secondary)]">
        {{ $t('请先上传批量创建文件，再点击创建云手机。') }}
      </p>
      <RyTable :columns="columns" :data-list="rows" data-key="key" :immediate="false" :paginator="false" :show-table-header="false" :show-actions="false" :context-menu="false" :scrollable="false" :table-style="{ minWidth: '704px' }" class="min-h-92 !h-auto">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_star.svg" :title="$t('请先上传批量创建文件')" class="min-h-82" />
        </template>
        <template #id="{ data }">
          <span class="block max-w-32 truncate font-mono" :title="data.id">{{ data.id || '--' }}</span>
        </template>
        <template #name="{ data }">
          <span class="block max-w-40 truncate" :title="data.name">{{ data.name || '--' }}</span>
        </template>
        <template #status="{ data }">
          <span :class="data.status === 'failed' ? 'tt-error' : data.status === 'success' ? 'tt-success' : 'tt-tertiary'">
            {{ data.status === 'success' ? $t('创建成功') : data.status === 'failed' ? $t('创建失败') : $t('待创建') }}
          </span>
        </template>
        <template #error="{ data }">
          <span class="block max-w-48 whitespace-normal break-words py-3">{{ data.error || '--' }}</span>
        </template>
        <template #actions="{ data }">
          <RxButton size="xxs" severity="secondary" text :label="$t('移除')" @click="removeRow(data.key)" />
        </template>
      </RyTable>
    </section>
  </div>
</template>
