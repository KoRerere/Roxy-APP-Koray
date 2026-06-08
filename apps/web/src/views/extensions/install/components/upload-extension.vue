<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { RxSvgIcon } from '/@/components/rx-icon/'

import { ExtensionsSource } from '/@/enums'

const dialogRef = inject<any>('dialogRef')
const toast = useToast()

const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()

const extension = ref()
const extensionOss = ref()

async function selectExtension(selectType: 'dir' | 'file') {
  try {
    const { type, data, message: msg } = await globalThis.electronAPI.send('extension:getSelectedExtensionInfo', selectType)
    console.log('selectExtension ~ type, data, msg:', type, data, msg)
    const isSuccess = type === 'success'
    if (isSuccess) {
      extension.value = {
        type,
        isSuccess,
        ...(isSuccess ? data : {}),
      }
    }
    else {
      toast.add({ severity: type, summary: (msg || data as any), life: 2500 })
    }
  }
  catch (error) {
    console.log('selectExtension ~ error:', error)
  }
}

async function uploadToOSS() {
  const { pluginPath, pluginIconPath } = extension.value
  const { localKey, pluginDir } = dialogRef.value.data
  extensionOss.value = await globalThis.electronAPI.send('extension:uploadExtensionToOSS', { pluginDir, pluginPath, pluginIconPath, localKey })
}

async function confirm() {
  try {
    await uploadToOSS()
    await _onConfirm.value?.({
      source: ExtensionsSource.local,
      ...extension.value,
      ...extensionOss.value,
    })
    close()
  }
  catch (error) {
    toast.add({ severity: 'error', summary: $t('发生错误'), detail: error, life: 2500 })
  }
}

function close() {
  dialogRef.value.close()
  _onCancel.value?.()
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  _props.value = props
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
})
</script>

<template>
  <div class="flex flex-col popup">
    <div class="popup-title">
      {{ $t('本地上传') }}
    </div>

    <div>
      <div class="upload-title">
        {{ $t('请选择上传方式') }}
      </div>
      <div class="flex items-center gap-4 mt-1">
        <RxButton outlined icon="base/rx_ic_export" :label="$t('选择压缩包')" @click="selectExtension('file')" />
        <span class="upload-or">{{ $t('或') }}</span>
        <RxButton outlined severity="secondary" icon="base/rx_ic_folder" :label="$t('选择文件夹')" @click="selectExtension('dir')" />
      </div>
      <div class="flex items-center gap-1 mt-1">
        <RxSvgIcon name="base/rx_ic_info_fill" :size="12" color="#A3A9AD" />
        <span class="upload-tip">{{ $t('支持Zip, CRX 格式的扩展，最大不超过 50MB') }}</span>
      </div>
      <div class="flex items-center gap-1 mt-1">
        <RxSvgIcon name="base/rx_ic_info_fill" :size="12" color="#A3A9AD" />
        <span class="upload-tip">{{ $t('每日总扩展添加数量限制为 {count} 个。', { count: 50 }) }}</span>
      </div>
      <div class="flex items-center gap-1 mt-1">
        <RxSvgIcon name="base/rx_ic_info_fill" :size="12" color="#A3A9AD" />
        <span class="upload-tip">{{ $t('当前仅支持 Google 扩展，暂不支持 Firefox 扩展。') }}</span>
      </div>
    </div>

    <div v-if="extension?.isSuccess" class="extension">
      <div class="extension-icon">
        <img class="extension-icon-image" :src="extension.pluginIconPath">
      </div>
      <div class="flex justify-between items-center extension-name">
        <span>{{ $t('扩展名称') }}</span>
        <span class="extension-name-length">{{ extension.pluginName.length }}/50</span>
      </div>
      <InputText v-model="extension.pluginName" class="extension-input" maxlength="50" type="text" />
    </div>

    <div v-if="extension?.isSuccess" class="flex flex-col gap-1.5 description">
      <div class="flex justify-between items-center">
        <span>{{ $t('扩展描述') }}</span>
        <span class="description-length">{{ extension.pluginDesc?.length || 0 }}/500</span>
      </div>
      <Textarea v-model="extension.pluginDesc" class="w-full description-input" maxlength="500" rows="3" />
    </div>

    <div class="guide">
      <i18n-t :keypath="$t('请注意您的扩展需要满足{guide}以确保能正常运行', { guide: '{guide}' })" scope="global">
        <template #guide>
          <a href="https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline#june_3_2024_the_manifest_v2_phase-out_begins" target="_blank" rel="noopener noreferrer"
             class="text-blue decoration-underline cursor-pointer"
          >{{ $t('Google 扩展协议') }}</a>
        </template>
      </i18n-t>
    </div>
    <div class="footer">
      <RxButton size="sm" :label="$t('取消')" text severity="secondary" autofocus @click="close" />
      <RxButton size="sm" :label="$t('上传')" :disabled="!extension?.isSuccess" autofocus @click="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-textarea) {
  resize: none;
}

.popup {
  width: 400px;
  padding-top: 1.25rem;
  gap: var(--spacing-2xl, 16px);

  &-title {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
  }
}

.upload {
  &-title {
    color: var(--colors-text-text-tertiary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 18px;
  }

  &-or {
    color: var(--colors-text-text-primary, #fafafa);
    text-align: center;
    font-family: Inter;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
  }

  &-tip {
    margin-top: 4px;
    color: var(--colors-text-text-tertiary, #575d60);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.extension {
  display: grid;
  grid-template-areas:
    'left right-top'
    'left right-bottom';
  align-items: center;
  grid-template-columns: 60px 1fr;
  gap: var(--spacing-sm, 4px) var(--spacing-lg, 8px);
  font-family: Inter;
  line-height: var(--Line-Height-text-lg, 20px);
  font-size: 12px;

  &-icon {
    grid-area: left;
    padding: var(--spacing-xl, 12px);
    width: 60px;
    height: 60px;
    border-radius: var(--radius-lg, 8px);
    border: 1px solid var(--colors-border-border-base, #c7cdd1);
    background: var(--colors-background-bg-block);

    &-image {
      width: 100%;
      aspect-ratio: 1;
    }
  }

  &-name {
    grid-area: right-top;
    color: var(--colors-text-text-primary, #171c1f);
    font-weight: 500;

    &-length {
      color: var(--colors-text-text-inactive, #a3a9ad);
      font-weight: 400;
    }
  }

  &-input {
    grid-area: right-bottom;
    color: var(--colors-text-text-primary, #111213);
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.description {
  color: var(--colors-text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);

  &-length {
    color: var(--colors-text-text-inactive, #a3a9ad);
    font-weight: 400;
  }

  &-input {
    color: var(--colors-text-text-primary, #111213);
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.guide {
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
