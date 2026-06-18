<script setup lang="ts">
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ExcelAccept, TextAccept } from '/@/utils/constants'
import { getExtname } from '/@/utils'
import { normalizeImportCellText, parseIntelligent } from '/@/views/account/create/utils'
import ExcelJS from 'exceljs'

const router = useRouter()
const [showToast, onlyErrorToast] = useResponseToast()

const FILE_MAX_SIZE = 5 * 1024 * 1024
const FILE_ACCEPT = Object.freeze({ ...ExcelAccept, ...TextAccept })
const MAX_IMPORT_COUNT = 200

const fileData = reactive({
  status: false,
  name: '',
})
const pendingRows = ref<any[]>([])
const saving = ref(false)

async function chooseFile() {
  const file = await (window as any).showOpenFilePicker({
    types: [{ description: 'Account Files', accept: FILE_ACCEPT }],
    excludeAcceptAllOption: true,
    multiple: false,
  }).then((handleFile: FileSystemFileHandle[]) => handleFile[0]?.getFile())

  if (file)
    await handleUpload(file)
}

function fileDragover(event: Event) {
  event.preventDefault()
}

async function fileDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file)
    await handleUpload(file)
}

async function handleUpload(rawFile: File) {
  if (rawFile.size > FILE_MAX_SIZE) {
    onlyErrorToast(-1, $t('文件大小不能超过 5MB'))
    return
  }

  const rows = getExtname(rawFile.name) === 'txt'
    ? await parseTxtFile(rawFile)
    : await parseExcelFile(rawFile)

  if (!rows.length) {
    onlyErrorToast(-1, $t('未解析到有效账号数据'))
    return
  }

  if (rows.length > MAX_IMPORT_COUNT) {
    onlyErrorToast(-1, $t('最多一次导入 {count} 个账号', { count: MAX_IMPORT_COUNT }))
    return
  }

  fileData.status = true
  fileData.name = rawFile.name
  pendingRows.value = rows
}

async function parseTxtFile(file: File) {
  const text = await file.text()
  const { data: { rows } } = await API.platform.userGetPlatformInfoList({})
  const defaultPlatform = rows[0]

  return text.split('\n').map(line => line.trim()).filter(Boolean).map((line) => {
    const parsed = parseIntelligent(line)
    return {
      platformIcon: defaultPlatform?.platformIcon ?? '',
      platformIconDark: defaultPlatform?.platformIconDark ?? '',
      platformUrl: defaultPlatform?.platformUrl ?? '',
      platformUserName: parsed.username ?? '',
      platformPassword: parsed.password ?? '',
      platformEfa: parsed.twoFactor ?? '',
      platformRemarks: parsed.remark ?? '',
      platformName: '',
    }
  })
}

async function parseExcelFile(file: File) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet)
    return []

  const headerRow = sheet.getRow(1)
  const headers = headerRow.values as string[]
  const keyMap: Record<string, string> = {
    [$t('平台')]: 'platformUrl',
    'platformUrl': 'platformUrl',
    [$t('账号')]: 'platformUserName',
    'platformUserName': 'platformUserName',
    [$t('密码')]: 'platformPassword',
    'platformPassword': 'platformPassword',
    '2FA': 'platformEfa',
    'platformEfa': 'platformEfa',
    [$t('备注')]: 'platformRemarks',
    'platformRemarks': 'platformRemarks',
  }

  const rows: any[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1)
      return
    const item: Record<string, string> = {
      platformIcon: '',
      platformIconDark: '',
      platformName: '',
    }
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber]
      const key = keyMap[header as string]
      if (key)
        item[key] = normalizeImportCellText(cell.value)
    })
    if (item.platformUrl || item.platformUserName)
      rows.push(item)
  })
  return rows
}

async function saveAccounts(keepAdding = false) {
  if (!pendingRows.value.length) {
    onlyErrorToast(-1, $t('请先上传账号文件'))
    return
  }
  saving.value = true
  const { code, msg } = await API.platform.userAddPlatformInfoBatchCreate(toRaw(pendingRows.value))
  saving.value = false
  if (code !== 0) {
    onlyErrorToast(code, msg)
    return
  }
  showToast(0, $t('导入成功'))
  if (keepAdding) {
    pendingRows.value = []
    fileData.status = false
    fileData.name = ''
    return
  }
  router.replace({ name: 'account-list' })
}

async function downloadTemplate() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Accounts')
  worksheet.columns = [
    { header: $t('平台'), key: 'platformUrl', width: 30 },
    { header: $t('账号'), key: 'platformUserName', width: 20 },
    { header: $t('密码'), key: 'platformPassword', width: 20 },
    { header: '2FA', key: 'platformEfa', width: 20 },
    { header: $t('备注'), key: 'platformRemarks', width: 20 },
  ]
  worksheet.addRow({
    platformUrl: 'https://www.facebook.com/',
    platformUserName: 'example@gmail.com',
    platformPassword: 'password123',
    platformEfa: '',
    platformRemarks: '',
  })
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'account_import_template.xlsx'
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="flex flex-col h-full pt-4 px-4 content">
    <div class="template-import">
      <div class="upload-card" @dragover="fileDragover" @drop="fileDrop">
        <div class="upload-card__dropzone">
          <SvgIcon name="base/rx_ic_doc_fill" size="48" color="var(--colors-icon-icon-note)" />
          <div class="upload-card__text">
            <div class="upload-card__title">
              {{ $t('选择文件并拖拽到此处') }}
            </div>
            <div class="upload-card__desc">
              {{ $t('在此上传编辑后的文件，仅支持 .xlsx .txt 文件，最大 5MB。') }}
            </div>
          </div>
          <RxButton icon="base/rx_ic_export" :label="fileData.status ? $t('重新上传') : $t('上传文件')" outlined severity="secondary" @click="chooseFile" />
          <div v-if="fileData.status" class="upload-card__filename">
            {{ fileData.name }}
          </div>
        </div>
      </div>
      <i18n-t tag="div" class="template-tip" :keypath="$t('点击下载 {link}。一次最多可导入 {count} 个账号。', { link: '{link}', count: MAX_IMPORT_COUNT })" scope="global">
        <template #link>
          <span class="template-link" @click="downloadTemplate">{{ $t('账号导入模板') }}</span>
        </template>
      </i18n-t>
    </div>
    <div class="flex flex-1 items-end">
      <div class="w-full flex justify-end gap-3 pt-4 pb-5">
        <RxButton severity="secondary" outlined :loading="saving" :label="$t('保存 & 继续添加')" @click="saveAccounts(true)" />
        <RxButton :loading="saving" :label="$t('保存')" @click="saveAccounts(false)" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  min-width: 384px;
}

.template-import {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 16px;
}

.upload-card {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-page);

  &__dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 64px 0;
    border-radius: 8px;
    background: var(--colors-background-bg-block);
    text-align: center;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  &__title {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }

  &__desc {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }

  &__filename {
    color: var(--colors-text-text-brand);
    font-size: 12px;
    line-height: 16px;
  }
}

.template-tip {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  text-align: left;
}

.template-link {
  color: var(--colors-text-text-brand);
  text-decoration: underline;
  cursor: pointer;
}
</style>
