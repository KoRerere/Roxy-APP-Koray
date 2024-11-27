<script lang="ts" setup>
import { read, utils } from 'xlsx'
import { RxAlert } from '/@/components/rx-alert'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { ExcelAccept } from '/@/utils/constants'

const emit = defineEmits(['importSuccess'])

const nameMap = {
  '窗口名称': 'windowName',
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
} as const

type Data = Partial<Record<typeof nameMap[keyof typeof nameMap], any>> & { rowNum: number }
const [showToast, onlyErrorToast] = useResponseToast()

const fileAnalyzeError = defineModel<any>()

const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileDragover(event: Event) {
  event.preventDefault()
}

function fileDrop(event: any) {
  event.preventDefault()
  const file: File = event.dataTransfer.files[0]
  if (!file || !Object.keys(ExcelAccept).includes(file.type)) {
    onlyErrorToast(-1, $t('仅支持Excel类型文件'))
    return
  }
  handleBeforeUpload(file)
}

async function chooseFile() {
  const file = await (window as any).showOpenFilePicker({
    types: [
      {
        description: 'Excel Files',
        accept: ExcelAccept,
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  }).then((handleFile: FileSystemFileHandle[]) => handleFile[0].getFile())

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
    onlyErrorToast(-1, $t('文件大小不能超过 5MB'))
    return
  }

  const fileName = rawFile.name
  const rowStartNum = 5
  const workbook = read(await rawFile.arrayBuffer())
  const result = utils.sheet_to_json<Record<string, any>>(workbook.Sheets[workbook.SheetNames[0]])
  const excelData = result.slice(3).reduce((prev, curr, index) => {
    const obj: Data = {
      rowNum: index + rowStartNum,
    }
    Object.entries(curr).forEach(([key, value]) => {
      const keyName = nameMap[key as keyof typeof nameMap]

      if (keyName === 'cookie' && value) {
        try {
          const res = JSON.parse(value)
          obj[keyName] = Array.isArray(res) ? res : []
        }
        catch (error) {
          console.error('cookie parse error', error)
        }
      }
      else {
        obj[keyName] = value
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
    onlyErrorToast(-1, $t('导入的内容不能为空'))
    return
  }

  fileData.status = true
  fileData.name = fileName
  fileData.size = `${(rawFile.size / 1024 / 1024).toFixed(2)} MB`
  fileData.successCount = excelData.length
  emit('importSuccess', fileAnalyzeData)
  showToast(0, `${fileData.successCount} ${$t('个窗口已成功导入')}`)
  return false
}
</script>

<template>
  <div>
    <div class="upload-title">
      <i18n-t :keypath="$t('请点击下载 {templateFile}，一次性最多导入500个窗口。', { templateFile: '{templateFile}' })" scope="global">
        <template #templateFile>
          <a href="https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/template/Roxy%E7%AA%97%E5%8F%A3%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xls" target="_blank" class="upload-title-link">{{
            $t('窗口导入模板') }}</a>
        </template>
      </i18n-t>
    </div>
    <div class="upload-area" @dragover="fileDragover" @drop="fileDrop">
      <SvgIcon name="base/rx_ic_doc_fill" :size="48" color="#E4E8EB" />
      <div class="text-center">
        <div class="upload-area-title">
          {{ fileData.name || $t('请拖拽到此处或点击上传') }}
        </div>
        <div class="w-60 ma-auto">
          {{ fileData.size || $t('请将编辑好的文件在此处上传，仅支持 .xlsx 类型文件, 最大不超过 5MB.') }}
        </div>
      </div>
      <RxButton icon="base/rx_ic_export" :label="fileData.status ? $t('重新上传') : $t('上传文件')" outlined severity="secondary" @click="chooseFile" />
    </div>
    <RxAlert v-if="fileData.status && !fileAnalyzeError" class="w-full mt-2" type="success" :title="$t('上传成功')" :closable="false" />
    <RxAlert v-if="fileAnalyzeError" class="w-full mt-2" type="error" :closable="false">
      <template #content>
        <div class="whitespace-pre-wrap">
          {{ fileAnalyzeError.join('\n') }}
        </div>
      </template>
    </RxAlert>
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
  padding: var(--oversize-spacing-2rem, 32px) var(--spacing-none, 0px);
  gap: var(--spacing-2xl, 16px);
  border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
  border: 1px dashed var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Color-neutrals-50, #fafbfc);

  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);

  &-title {
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }
}
</style>
