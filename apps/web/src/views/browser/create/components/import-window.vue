<script lang="ts" setup>
import { count } from 'node:console'
import { useToast } from 'primevue/usetoast'
import { read, utils } from 'xlsx'

const emit = defineEmits(['importSuccess'])

const toast = useToast()

const ExcelAccept = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12': ['.xlsb'],
}

const nameMap = {
  '窗口名称': 'windowName',
  '分组': 'groupName',
  '账号平台': 'platformUrl',
  '用户名': 'platformUserName',
  '密码': 'platformPassword',
  '2FA秘钥': 'efa',
  'Cookie': 'cookie',
  '打开指定网址': 'defaultOpenUrl',
  '代理类型': 'proxyMethod',
  '代理信息': 'proxyInfo',
  '刷新URL': 'refreshUrl',
  '窗口备注': 'windowRemark',
  'User Agent': 'userAgent',
  '窗口尺寸': 'windowSize',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileDragover(event: Event) {
  event.preventDefault()
}
function fileDrop(event: Event) {
  event.preventDefault()
  const file: File = event.dataTransfer.files[0]
  if (!file || !Object.keys(ExcelAccept).includes(file.type)) {
    toast.add({ severity: 'error', summary: 'Upload error', detail: '请选择 Excel 文件', life: 5000, group: 'tc' })
    return
  }
  handleBeforeUpload(file)
}

async function chooseFile() {
  const file = await window.showOpenFilePicker({
    types: [
      {
        description: 'Excel Files',
        accept: ExcelAccept,
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  })
    .then((handleFile: FileSystemFileHandle[]) => handleFile[0].getFile())

  handleBeforeUpload(file)
}

const fileData = reactive({
  status: false,
  name: '',
  size: '',
  successCount: 0,
})

async function handleBeforeUpload(rawFile: any) {
  if (rawFile.size > MAX_FILE_SIZE) {
    toast.add({ severity: 'error', summary: 'Upload error', detail: '文件大小不能超过5MB', life: 5000, group: 'tc' })
    return
  }

  const fileName = rawFile.name
  const rowStartNum = 5
  const workbook = read(await rawFile.arrayBuffer())
  const result = utils.sheet_to_json<Record<string, any>>(workbook.Sheets[workbook.SheetNames[0]])
  const excelData = result.slice(3).reduce((prev, curr, index) => {
    const obj = {
      rowNum: index + rowStartNum,
    }
    Object.entries(curr).forEach(([key, value]) => {
      if (nameMap[key] === 'cookie' && value) {
        try {
          const res = JSON.parse(value)
          if (Array.isArray(res)) {
            obj[nameMap[key]] = res
          }
          else {
            obj[nameMap[key]] = []
          }
        }
        catch (error) {
          console.error('cookie parse error', error)
        }
      }
      else {
        obj[nameMap[key]] = value
      }
    })
    prev.push(obj)
    return prev
  }, [])

  const fileAnalyzeData = {
    fileName,
    excelData,
  }

  if (excelData.length === 0) {
    return toast.add({ severity: 'error', summary: 'Upload error', detail: '导入的窗口数量不能为0', life: 5000, group: 'tc' })
  }

  fileData.status = true
  fileData.name = fileName
  fileData.size = `${(rawFile.size / 1024 / 1024).toFixed(2)} MB`
  fileData.successCount = excelData.length
  emit('importSuccess', fileAnalyzeData)
  toast.add({ severity: 'success', summary: 'Upload success', detail: `${fileData.successCount} profiles imported`, life: 5000, group: 'tc' })
  return false
}
</script>

<template>
  <div>
    <div class="upload-title">
      Please download our <a
        href="https://lumibrowser-hk.oss-cn-hongkong.aliyuncs.com/public/static/template/Lumi%E7%AA%97%E5%8F%A3%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xls"
        class="upload-title-link">template file</a> here. After you finish editing, upload it
      through the
      following steps.
    </div>
    <div class="upload-notice">
      * We only support create up to 500 profiles every time.
    </div>
    <div class="upload-area" @dragover="fileDragover" @drop="fileDrop">
      <span class="mdi mdi-file-outline upload-area-icon" />
      <div class="text-center">
        <div>{{ fileData.name || 'Choose file and drop it here' }}</div>
        <div>{{ fileData.size || 'Only .xlsx files supported, up to 5MB.' }}</div>
      </div>
      <ryButton icon="base/rx_ic_export" :label="fileData.status ? 'Upload again' : 'Upload template file'" outlined
        severity="secondary" @click="chooseFile" />
    </div>
    <Message v-if="fileData.status" class="upload-message" severity="success" icon="pi pi-check-circle">
      {{ fileData.successCount }} profiles imported
    </Message>
  </div>
</template>

<style lang="scss" scoped>
.upload-title {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;

  &-link {
    color: var(--Colors-Text-text-brand, #12a3fc);
    text-decoration-line: underline;
    cursor: pointer;
    user-select: none;
  }
}

.upload-notice {
  margin-top: var(--spacing-4xl, 24px);
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: stretch;
  margin-top: var(--spacing-lg, 8px);
  padding: var(--oversize-spacing-4rem, 64px) var(--spacing-none, 0px);
  gap: var(--spacing-2xl, 16px);
  border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
  border: 1px dashed var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Color-neutrals-50, #fafbfc);

  &-icon {
    font-size: 48px;
    line-height: 1;
  }
}

.upload-message {
  margin-top: var(--spacing-lg, 8px);
}
</style>
