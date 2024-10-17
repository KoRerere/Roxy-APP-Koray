<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

const dialogRef = inject<any>('dialogRef')
const toast = useToast()

const loading = ref(false)
const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()

const extension = ref()
const extensionOss = ref()

async function selectExtension(selectType: 'dir' | 'file') {
  try {
    const { type, data, message: msg } = await window.electronAPI.send('extension:getSelectedExtensionInfo', selectType)
    console.log('selectExtension ~ type, data, msg:', type, data, msg)
    const isSuccess = type === 'success'
    if (isSuccess) {
      const message = isSuccess ? $t('Extension parse successfully') : (msg || data)
      extension.value = {
        type,
        message,
        isSuccess,
        ...(isSuccess ? data : {}),
      }
    }
    else {
      toast.add({ severity: type, summary: msg, life: 2500 })
    }
  }
  catch (error) {
    console.log('selectExtension ~ error:', error)
  }
}

async function uploadToOSS() {
  const { pluginDir, pluginIcon } = extension.value
  extensionOss.value = await window.electronAPI.send('extension:uploadExtensionToOSS', { pluginDir, pluginIcon })
}

async function confirm() {
  try {
    loading.value = true
    await uploadToOSS()
    await _onConfirm.value?.({
      source: 'local',
      ...extension.value,
      ...extensionOss.value,
    })
    close()
  }
  catch (error) {
    toast.add({ severity: 'error', summary: $t('Error'), detail: error, life: 5000 })
  }
  finally {
    loading.value = false
  }
}

function close() {
  loading.value = false
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
      {{ $t('Upload Extension') }}
    </div>

    <rxMessage v-if="extension" :severity="extension.type"
      :icon="extension.isSuccess ? 'status/rx_ic_check_fill' : 'status/rx_ic_delete_fill'" closable>
      {{ extension.message }}
    </rxMessage>
    <div>
      <div class="upload-title">
        {{ $t('Select your extension') }}
      </div>
      <div class="flex items-center gap-4 mt-1">
        <ryButton outlined severity="info" icon="base/rx_ic_export" :label="$t('Select a file')"
          @click="selectExtension('file')" />
        <span class="upload-or">OR</span>
        <ryButton outlined severity="secondary" icon="base/rx_ic_folder" :label="$t('Select a folder')"
          @click="selectExtension('dir')" />
      </div>
      <div class="flex items-center gap-1 mt-1">
        <RxSvgIcon name="base/rx_ic_info_fill" :size="12" color="#A3A9AD" />
        <span class="upload-tip">{{ $t('Zip, CRX file supported, file limited to 50MB max.') }}</span>
      </div>
    </div>

    <div v-if="extension?.isSuccess" class="extension">
      <div class="extension-icon">
        <img class="extension-icon-image" :src="extension.pluginIcon">
      </div>
      <div class="flex justify-between items-center extension-name">
        <span>{{ $t('Extension name') }}</span>
        <span class="extension-name-length">{{ extension.pluginName.length }}/50</span>
      </div>
      <InputText v-model="extension.pluginName" class="extension-input" maxlength="50" type="text" />
    </div>

    <div v-if="extension?.isSuccess" class="description">
      <div class="flex justify-between items-center">
        <span>{{ $t('Description') }}</span>
        <span class="description-length">{{ extension.pluginDesc.length }}/500</span>
      </div>
      <Textarea v-model="extension.pluginDesc" class="w-full description-input" maxlength="500" rows="3" />
    </div>

    <div class="guide">
      <i18n-t
        :keypath="$t('Please note that your extension should follow the {guide} in order to install in our chrome kernel.', { guide: '{guide}' })"
        scope="global">
        <template #guide>
          <a href="https://chromewebstore.google.com/" target="_blank"
            class="text-blue decoration-underline cursor-pointer">{{ $t('chrome extension guideline') }}</a>
        </template>
      </i18n-t>
    </div>
    <div class="footer">
      <Button size="small" :label="$t('Cancel')" text severity="secondary" autofocus @click="close" />
      <Button size="small" :label="$t('Upload and Install')" severity="info" :disabled="!extension?.isSuccess"
        :loading="loading" autofocus @click="confirm" />
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
    color: #000;
    font-family: Inter;
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
  }
}

.upload {
  &-title {
    color: var(--Color-neutrals-600, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-weight: 400;
    line-height: 18px;
  }

  &-or {
    color: #000;
    text-align: center;
    font-family: Inter;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
  }

  &-tip {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 10px;
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
    border: 1px solid var(--Colors-Border-border-container, #c7cdd1);
    background: var(--Colors-Background-bg-body, #fff);

    &-image {
      width: 100%;
      aspect-ratio: 1;
    }
  }

  &-name {
    grid-area: right-top;
    color: var(--Component-Colors-TextInput-label-label, #171c1f);
    font-weight: 500;

    &-length {
      color: var(--Colors-Text-text-inactive, #a3a9ad);
      font-weight: 400;
    }
  }

  &-input {
    grid-area: right-bottom;
    color: var(--Component-Colors-TextInput-text-text, #171c1f);
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.description {
  color: var(--Component-Colors-TextInput-label-label, #171c1f);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);

  &-length {
    color: var(--Colors-Text-text-inactive, #a3a9ad);
    font-weight: 400;
  }

  &-input {
    color: var(--Component-Colors-TextInput-text-text, #171c1f);
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.guide {
  color: var(--Color-neutrals-600, #575d61);
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
