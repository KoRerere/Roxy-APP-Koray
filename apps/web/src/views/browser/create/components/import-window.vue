<script lang="ts" setup>
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { ExcelAccept, TextAccept } from '/@/utils/constants'
import { downloadTemplate, downloadTextTemplate, parseTemplate, parseTextFile } from '../utils';
import { useUserStore } from '/@/stores/user'
import { getExtname } from '/@/utils'

const emit = defineEmits(['importSuccess'])

const [showToast, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()

const FILE_MAX_SIZE = 5 * 1024 * 1024
const FILE_ACCEPT = Object.freeze({ ...ExcelAccept, ...TextAccept })

const fileAnalyzeError = defineModel<any>()

const timenuRef = useTemplateRef('timenu')
const templateList = [
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
const fileData = reactive({
  status: false,
  name: '',
  size: '',
  successCount: 0,
})
const maxWindowCount = computed(() => userStore.userPayInfo.maxWindowCount - userStore.userPayInfo.useWindowCount)

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

function openTemplates(event: Event) {
  timenuRef.value?.toggle(event)
}
</script>

<template>
  <div>
    <div class="upload-title">
      <i18n-t :keypath="$t('请点击下载 {templateFile}，一次性最多导入{maxCreateWindowCount}个窗口。', { templateFile: '{templateFile}', maxCreateWindowCount: '{maxCreateWindowCount}' })" scope="global">
        <template #templateFile>
          <span class="upload-title-link" @click="openTemplates">{{ $t('窗口导入模板') }}</span>
        </template>
        <template #maxCreateWindowCount>
          {{ maxWindowCount }}
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
          {{ fileData.size || $t('请将编辑好的文件在此处上传，仅支持 {type} 类型文件, 最大不超过 5MB.', { type: '.xlsx .txt' }) }}
        </div>
      </div>
      <RxButton icon="base/rx_ic_export" :label="fileData.status ? $t('重新上传') : $t('上传文件')" outlined severity="secondary" @click="chooseFile" />
    </div>
    <RxAlert v-if="fileData.status && !fileAnalyzeError" class="w-full mt-2" type="success" :title="$t('上传成功')" :closable="false" />
    <RxAlert v-if="fileAnalyzeError" class="w-full mt-2" type="error" @close="fileAnalyzeError = null">
      <template #content>
        <div class="whitespace-pre-wrap">
          {{ fileAnalyzeError }}
        </div>
      </template>
    </RxAlert>
    <TieredMenu ref="timenu" :model="templateList" popup>
      <template #item="{ item, props }">
        <a v-ripple class="flex items-center !py-2 !px-2.5 max-w-60" v-bind="props.action">
          <div class="w-full text-4 ellipsis-1 cursor-pointer">{{ item.label }}</div>
        </a>
      </template>
    </TieredMenu>
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
