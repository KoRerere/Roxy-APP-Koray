<script setup lang="ts">
import type { UnwrapRowType, UserGetPluginWindowListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ExtensionsInstallStatus, ExtensionsInstallType } from '/@/enums'
import { $t } from '/@/locales'
import type { InstallType } from './type'

type DataItem = UnwrapRowType<UserGetPluginWindowListData>
const allInstall = ExtensionsInstallType.all.toString()
const partialInstall = ExtensionsInstallType.partial.toString()

const dialogRef = inject<any>('dialogRef')
const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()

const installType = ref(allInstall)
const categories = ref([
  { label: $t('All project'), value: allInstall },
  { label: $t('Partial project'), value: partialInstall },
])

const columns = [
  {
    title: $t('Profile info'),
    key: 'projectName',
  },
]
const dataList = ref()
const selection = ref()

function onChange() {
  if (installType.value === partialInstall) {
    getProfileList()
  }
}

async function getProfileList() {
  if (dataList.value) {
    return
  }
  const { data } = await API.plugins.userGetPluginWindowList({ pluginId: _props.value.id })
  dataList.value = data.rows
  selection.value = data.rows.filter((item: any) => item.plugin_install_status === ExtensionsInstallStatus.installed)
}

function getInstallStatus() {
  if (installType.value === allInstall) {
    return dataList.value?.map(() => ExtensionsInstallStatus.installed)
  }
  const map = new Map(selection.value?.map((item: DataItem) => [item.id, item.id]))
  return dataList.value?.map((item: DataItem) => map.get(item.id) === item.id ? ExtensionsInstallStatus.installed : ExtensionsInstallStatus.notInstalled)
}

async function confirm() {
  try {
    const params: InstallType = {
      installType: Number(installType.value),
      pluginId: _props.value.id,
      projectId: dataList.value?.map((item: any) => item.id),
      installStatus: getInstallStatus(), // 跟 projectId 中的顺序对应
    }
    await _onConfirm.value?.(params)
    close()
  }
  catch (error) {
    console.log('🚀 ~ confirm ~ error:', error)
  }
}

function close() {
  dialogRef.value.close()
  _onCancel.value?.()
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  installType.value = props.installType || allInstall
  _props.value = props
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
  getProfileList()
})
</script>

<template>
  <div class="flex flex-col overflow-y-hidden popup">
    <div class="popup-title">
      {{ $t('Install to profiles') }}
    </div>
    <div v-if="_props" class="extension">
      <div class="extension-icon">
        <img class="extension-icon-image" :src="_props.pluginIcon">
      </div>
      <div class="extension-name">
        {{ _props.pluginName }}
      </div>
      <div class="extension-version">
        v{{ _props.pluginVersion }}
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <div>{{ $t('Install to:') }}</div>
      <div v-for="category in categories" :key="category.value" class="flex items-center gap-2">
        <RadioButton v-model="installType" :input-id="category.value" name="install" :value="category.value" @change="onChange" />
        <label :for="category.value">{{ category.label }}</label>
      </div>
    </div>
    <div v-show="installType === partialInstall" class="h-60">
      <RyTable v-model:selection="selection" :columns="columns" :data-list="dataList" show-gridlines :show-table-header="false" :show-actions="false" :paginator="false" :multiple-operation="false"
        selection-mode="multiple" />
    </div>
    <div>
      <RxSvgIcon name="base/rx_ic_info" />
      <span>{{ $t('You can only install extension to profiles related to your projects.') }}</span>
    </div>
    <div class="footer">
      <RxButton size="sm" :label="$t('Cancel')" text severity="secondary" autofocus @click="close" />
      <RxButton size="sm" :label="$t('Save and install')" severity="info" autofocus @click="confirm" />
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

.extension {
  display: grid;
  grid-template-areas:
    'left right-top'
    'left right-bottom';
  align-items: center;
  grid-template-columns: 36px 1fr;
  gap: var(--spacing-sm, 4px) var(--spacing-2xl, 16px);
  font-family: Inter;
  line-height: var(--Line-Height-text-lg, 20px);
  font-size: 12px;

  &-icon {
    grid-area: left;
    padding: var(--spacing-md, 6px);
    width: 36px;
    height: 36px;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background: var(--Colors-Background-bg-body, #fff);

    &-image {
      width: 100%;
      aspect-ratio: 1;
    }
  }

  &-name {
    grid-area: right-top;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 13px;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-version {
    grid-area: right-bottom;
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.profile {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
