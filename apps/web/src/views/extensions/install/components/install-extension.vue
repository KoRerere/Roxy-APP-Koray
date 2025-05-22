<script setup lang="ts">
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ExtensionsInstallStatus, ExtensionsInstallType, PluginSwitchType } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'

const [_, onlyErrorToast] = useResponseToast()

type DataItem = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>
const switchValuePersonal = PluginSwitchType.personal.toString()
const switchValueTeam = PluginSwitchType.team.toString()
const role = useRoleStore()

const dialogRef = inject<any>('dialogRef')
const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()
const _enabled = ref(switchValuePersonal)

const columns = [
  {
    title: $t('项目名称'),
    slot: 'project',
  },
]
const dataList = ref()
const selection = ref()

async function getProfileList() {
  if (dataList.value) {
    return
  }
  const { data } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
  dataList.value = data.rows
  selection.value = data.rows.filter(item => _props.value.bindPluginId?.includes(item.project_id))
}

function getInstallStatus() {
  const map = new Map(selection.value?.map((item: DataItem) => [item.project_id, item.project_id]))

  const installStatus = dataList.value.map((item: DataItem) => map.get(item.project_id) === item.project_id ? ExtensionsInstallStatus.installed : ExtensionsInstallStatus.notInstalled)
  const installType = installStatus.includes(ExtensionsInstallStatus.notInstalled) ? ExtensionsInstallType.partial : ExtensionsInstallType.all

  return {
    installStatus,
    installType,
  }
}

async function confirm() {
  if (_props.value.required && !selection.value?.length) {
    onlyErrorToast(-1, $t('请选择至少一个项目'))
    return
  }

  try {
    const params = {
      pluginSwitchType: Number(_enabled.value),
      projectId: dataList.value?.map((item: any) => item.project_id),
      ...getInstallStatus(), // 跟 projectId 中的顺序对应
    }
    await _onConfirm.value?.(params)
    close()
  }
  catch (error) {
    console.log(error)
  }
}

function close() {
  dialogRef.value.close()
  _onCancel.value?.()
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  _props.value = props
  _enabled.value = props.pluginSwitchType?.toString() || switchValuePersonal
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
  getProfileList()
})
</script>

<template>
  <div class="flex flex-col overflow-y-hidden popup">
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
    <div>
      <div class="title">
        {{ $t('安装到项目:') }}
      </div>
      <div class="description">
        {{ $t('扩展将被安装至所选项目中的所有窗口') }}
      </div>
      <div class="project-table mt-2.5 h-60">
        <RyTable v-model:selection="selection" data-key="project_id" :columns="columns" :data-list="dataList"
          :show-table-header="false" :show-actions="false" :paginator="false" :multiple-operation="false"
          selection-mode="multiple" size="small">
          <template #project="{ data }">
            <div class="flex items-center gap-2">
              <RxSvgIcon name="base/rx_ic_stack" color="var(--Colors-Icon-icon-secondary, #575D61)" />
              <span class="project-name">{{ data.projectName }}</span>
            </div>
          </template>
        </RyTable>
      </div>
      <div v-if="role.isOwner || role.isManager">
        <div class="line" />
        <div class="flex justify-between items-center">
          <span class="title">
            {{ $t('为所选项目的所有成员安装') }}
          </span>
          <rxToggleSwitch v-model="_enabled" :false-value="switchValuePersonal" :true-value="switchValueTeam" />
        </div>
        <div class="description">
          {{ $t('您可以在扩展列表中更改此选项') }}
        </div>
        <!-- <RxAlert v-if="_props?.canDelete === false" class="!w-full mt-2.5" :closable="false" type="info" :title="$t('该插件属于其他成员，请联系对方进行关闭操作。')" /> -->
      </div>
    </div>
    <div class="flex justify-end items-center gap-3">
      <RxButton size="sm" :label="$t('取消')" text severity="secondary" autofocus @click.stop="close" />
      <RxButton size="sm" :label="$t('保存')" severity="info" autofocus @click.stop="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 400px;
  padding-top: 1.25rem;
  gap: var(--spacing-2xl, 16px);
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
    color: var(--colors-text-text-primary, #fafafa);
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

.project-table {
  border-radius: 6px;
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Component-Colors-TextInput-bg-bg, #fff);
  overflow: hidden;
}

.project-name {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
}

.line {
  margin: var(--spacing-4xl, 24px) 0;
  height: 0.5px;
  width: 100%;
  background: var(--Colors-Border-border-container, #c7cdd1);
}

.title {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 13px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.description {
  margin-top: var(--spacing-sm, 4px);
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
