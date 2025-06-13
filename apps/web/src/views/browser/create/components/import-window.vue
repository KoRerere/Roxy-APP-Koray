<script lang="ts" setup>
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { ExcelAccept, TextAccept } from '/@/utils/constants'
import { downloadTemplate, downloadTextTemplate, parseTemplate, parseTextFile } from '../utils';
import { useUserStore } from '/@/stores/user'
import { usePopupMenu } from '/@/hooks/usePopupMenu';
import { getExtname } from '/@/utils'

const emit = defineEmits(['importSuccess'])

const { showMenu } = usePopupMenu()
const [showToast, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()

const FILE_MAX_SIZE = 5 * 1024 * 1024
const FILE_ACCEPT = Object.freeze({ ...ExcelAccept, ...TextAccept })

const fileAnalyzeError = defineModel<any>()

const fileData = reactive({
  status: false,
  name: '',
  size: '',
  successCount: 0,
})

const maxWindowCount = computed(() => Math.min(userStore.userPayInfo.maxWindowCount - userStore.userPayInfo.useWindowCount, 500))

function fileDragover(event: Event) {
  event.preventDefault()
}

function fileDrop(event: any) {
  event.preventDefault()
  const file: File = event.dataTransfer.files[0]
  if (!file || !Object.keys(FILE_ACCEPT).includes(file.type)) {
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
        accept: FILE_ACCEPT,
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  }).then((handleFile: FileSystemFileHandle[]) => handleFile[0].getFile())

  handleBeforeUpload(file)
}

async function handleBeforeUpload(rawFile: any) {
  if (rawFile.size > FILE_MAX_SIZE) {
    onlyErrorToast(-1, $t('文件大小不能超过 5MB'))
    return
  }
  fileAnalyzeError.value = null
  const fileName = rawFile.name
  const excelData = getExtname(fileName) === 'txt'
    ? await parseTextFile(rawFile)
    : await parseTemplate(rawFile)

  if (excelData.length === 0) {
    onlyErrorToast(-1, $t('导入的内容不能为空'))
    return
  }

  const fileAnalyzeData = {
    fileName,
    excelData,
  }

  try {
    const { code, msg } = await API.window.userAnalysisWindowInfoCreate(fileAnalyzeData as any)

    if (code === 0) {
      fileData.status = true
      fileData.name = fileName
      fileData.size = `${(rawFile.size / 1024 / 1024).toFixed(2)} MB`
      fileData.successCount = excelData.length
      showToast(0, $t('{count} 个窗口已成功导入', { count: fileData.successCount }))
      emit('importSuccess', fileAnalyzeData)
    }
    else {
      fileData.status = false
      fileAnalyzeError.value = Array.isArray(msg) ? msg.join('\n') : msg
    }
  }
  catch (error) {
    console.log(error)
  }
}

function openTemplates(event: MouseEvent) {
  showMenu(event, {
    model: [
      {
        label: $t('{type} 模板', { type: 'excel' }),
        command: () => {
          downloadTemplate()
        }
      },
      {
        label: $t('{type} 模板', { type: 'txt' }),
        command: () => {
          downloadTextTemplate()
        }
      }
    ]
  })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <RxAlert v-if="fileData.status && !fileAnalyzeError" class="w-full" type="success" :title="$t('上传成功')" :closable="false" />
    <RxAlert v-if="fileAnalyzeError" class="w-full" type="error" @close="fileAnalyzeError = null">
      <template #content>
        <div class="whitespace-pre-wrap">{{ fileAnalyzeError }}</div>
      </template>
    </RxAlert>
    <div class="content">
      <div class="upload" @dragover="fileDragover" @drop="fileDrop">
        <SvgIcon name="base/rx_ic_doc_fill" :size="48" color="var(--colors-icon-icon-note)" />
        <div class="text-center">
          <div class="upload-title">
            {{ fileData.name || $t('请拖拽到此处或点击上传') }}
          </div>
          <div class="w-60 mt-1.5 mx-auto">
            {{ fileData.size || $t('请将编辑好的文件在此处上传，仅支持 {type} 类型文件, 最大不超过 5MB.', { type: '.xlsx .txt' }) }}
          </div>
        </div>
        <RxButton icon="base/rx_ic_export" :label="fileData.status ? $t('重新上传') : $t('上传文件')" outlined severity="secondary" @click="chooseFile" />
      </div>
    </div>
    <div class="help">
      <i18n-t :keypath="$t('请点击下载 {templateFile}，一次性最多导入 {maxCreateWindowCount} 个窗口。', { templateFile: '{templateFile}', maxCreateWindowCount: '{maxCreateWindowCount}' })" scope="global">
        <template #templateFile>
          <span class="help-link" @click="openTemplates">{{ $t('窗口导入模板') }}</span>
        </template>
        <template #maxCreateWindowCount>
          {{ maxWindowCount }}
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--colors-border-border-inactive, #E2E9EE);
}

.upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: stretch;
  padding: 32px 0px;
  gap: var(--spacing-2xl, 16px);
  border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
  background: var(--colors-background-bg-block);

  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);

  &-title {
    font-size: 13px;
    color: var(--colors-text-text-primary);
    font-weight: 500;
  }
}

.help {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;

  &-link {
    color: var(--colors-text-text-brand);
    text-decoration-line: underline;
    cursor: pointer;
    user-select: none;
  }
}
</style>
