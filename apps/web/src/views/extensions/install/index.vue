<script setup lang="tsx">
import installExtension from '/@/views/extensions/install/components/install-extension.vue'
import uploadExtension from '/@/views/extensions/install/components/upload-extension.vue'
import ShieldDialog from '/@/views/extensions/install/components/shield-dialog.vue'
import HowToGet from '/@/views/extensions/install/components/how-to-get.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { API } from '/@/api'
import { useSimpleDialog } from '/@/components/simplePopup'
import { ExtensionsSource, extensionsSourceFormat, ExtensionsStatus, PluginSwitchType } from '/@/enums'
import { setColumns } from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoleStore } from '/@/stores/role'
import { usePermission } from '/@/hooks/usePermission'
import { useDialog as useCustomDialog } from '/@/hooks/useDialog'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { concurrentControl } from '/@/utils'

import type { UnwrapRowType, UserGetPluginListListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetPluginListListData>

defineEmits(['search'])
const confirm = useConfirm()
const dialog = useDialog()
const role = useRoleStore()
const { check } = usePermission()

const { showSimpleDialog } = useSimpleDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const [showModal] = useCustomDialog()
const { showMenu: showPopupMenu } = usePopupMenu()

const needsync = defineModel('needsync')
const tableRef = useTemplateRef('extable')

const checkUpdateExtension = ref<{ [key: string]: boolean }>({})
const updatingMap = ref<{ [key: string]: boolean }>({})

const columns = setColumns([
  {
    title: $t('扩展信息'),
    key: 'extension',
    slot: 'extension',
  },
  {
    title: $t('来源'),
    key: 'source',
    getText: (row: any) => extensionsSourceFormat(row.source) || $t('未知'),
  },
  {
    title: $t('扩展归属'),
    key: 'pluginSwitchType',
    slot: 'pluginSwitchType',
  },
  {
    title: $t('已安装项目'),
    key: 'related',
    slot: 'related',
  },
  {
    title: $t('更新信息'),
    key: 'pluginUpdateState',
    slot: 'update',
  },
])

const filters = reactive({
  value: undefined,
  options: [
    {
      name: $t('全部'),
      value: undefined,
    },
    {
      name: $t('团队'),
      value: PluginSwitchType.team,
    },
    {
      name: $t('个人'),
      value: PluginSwitchType.personal,
    },
  ],
  onChange() {
    tableRef.value?.refresh({ pluginSwitchType: filters.value })
    needsync.value = true
  },
  resetFilters() {
    filters.value = undefined
    filters.onChange()
  },
})

async function tableRequest(params: any) {
  return API.plugins.userGetPluginListList(params)
}

async function showPinMenu(event: any, data: any) {
  showPopupMenu(event, {
    mode: {
      type: 'single',
      value: data.fixedPlugin,
      options: [
        {
          label: $t('自定义'),
          name: 'customize',
        },
        {
          label: $t('始终固定到工具栏'),
          name: 'pin',
        },
        {
          label: $t('始终不固定到工具栏'),
          name: 'unpin',
        },
      ],
    },
    menuProps: {
      onHide: async ({ value }: any) => {
        if (value !== data.fixedPlugin) {
          await API.plugins.userFixedPluginToWindowCreate({ id: data.id, fixedPlugin: value })
          data.fixedPlugin = value
        }
      },
    },
    slots: {
      start: () => {
        return <div class="pl-4 pt-2">{$t('固定方式')}</div>
      },
    },
  })
}

function tableOperation(data: any) {
  const datas = [].concat(data)
  const isPersonal = !datas.some((data: any) => data.pluginSwitchType !== PluginSwitchType.personal)
  const canUpdate = datas.some((data: any) => data.pluginUpdateState === ExtensionsStatus.update)

  return [
    {
      name: 'checkUpdate',
      label: $t('检查更新'),
      icon: 'base/rx_ic_clock_rotate',
      power: isPersonal || check('Plugin_Installed_check_update'),
      multiple: true,
      multipleProps: {
        name: 'G1',
        showLabel: true,
      },
      visible: false,
      tooltip: $t('检查更新'),
      quick: true,
      command: ({ item }: any) => {
        operationHandler(item, data)
      },
    },
    {
      name: 'update',
      label: $t('更新'),
      icon: 'base/rx_ic_renew',
      power: isPersonal || check('Plugin_Installed_check_update'),
      visible: canUpdate,
      disabled: !canUpdate,
      disabledTooltip: $t('暂无需要更新的扩展'),
      multiple: true,
      multipleProps: {
        name: 'G2',
        showLabel: true,
      },
      command: ({ item }: any) => {
        operationHandler(item, data)
      },
    },
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      power: isPersonal || role.isOwner,
      visible: data.source === 'local',
      command: ({ item }: any) => {
        operationHandler(item, data)
      },
    },
    {
      name: 'install',
      label: $t('安装到项目'),
      icon: 'base/rx_ic_stack_install',
      power: isPersonal || check('Plugin_Installed_modify_attribution'),
      command: ({ item }: any) => {
        operationHandler(item, data)
      },
    },
    {
      power: isPersonal || check('Plugin_Installed_delete_plugin'),
      separator: true,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      disabled: datas.some((data: any) => !data.canDelete),
      disabledTooltip: $t('选项中包含其他人的插件'),
      power: isPersonal || check('Plugin_Installed_delete_plugin'),
      multiple: true,
      multipleProps: {
        name: 'G4',
        showLabel: true,
      },
      command: ({ item }: any) => {
        operationHandler(item, data)
      },
    },
  ]
}

async function operationHandler(operate: any, data: any) {
  const datas = [].concat(toRaw(data))

  switch (operate.name) {
    case 'install':
      onInstall(data)
      break
    case 'updateLocal':
      break
    case 'checkUpdate':
      return checkUpdate(data)
    case 'update':
      updateExtension(data)
      break
    case 'edit':
      onUploadExtension(data)
      break
    case 'delete':
      await deleteExtension(datas)
      break
  }
}

async function uploadRecordCheck() {
  const { data, msg } = await API.plugins.userRecordPluginUploadV2List()
  if (!data)
    throw msg
}

function installViaUrl() {
  showSimpleDialog({
    title: $t('添加 Google 扩展'),
    content: $t('每日总扩展添加数量限制为 5 个。'),
    confirmText: $t('确认添加'),
    inputs: [
      {
        name: 'url',
        type: 'text',
        props: {
          placeholder: $t('请输入 Google Store 中扩展的 URL'),
          preIcon: 'base/rx_ic_link',
        },
      },
    ],
    onConfirm: async (formData: any) => {
      try {
        await uploadRecordCheck()
        const { code, data, msg }: any = await API.plugins.userUploadChromePluginsV2Create(formData)
        if (code !== 0) {
          if (code === 421) { // 扩展推荐中已存在该扩展，直接安装
            filters.resetFilters()
            onInstall(data)
            return
          }
          onlyErrorToast(code, msg)
          return
        }

        filters.resetFilters()
        const plugin = await getExtensionDetail(data.plugin_id)
        onInstall(plugin)
      }
      catch (error) {
        onlyErrorToast(-1, error as string)
      }
    },
    afterRender: () => <HowToGet class="mt-2" />,
  })
}

function onUploadExtension(data = ({} as any)) {
  const { pluginDir, localKey } = data

  dialog.open(uploadExtension, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      localKey,
      pluginDir,
      onConfirm: async (params: any) => {
        try {
          await uploadRecordCheck()
          params.pluginDir = pluginDir || params.pluginDir
          const { code, data, msg } = await API.plugins.userUploadPluginInfoCreate(params)

          onlyErrorToast(code, msg)
          if (code === 0) {
            filters.resetFilters()
            const plugin = await getExtensionDetail(data.plugin_id)
            pluginDir || onInstall(plugin)
          }
        }
        catch (error) {
          onlyErrorToast(-1, error as string)
        }
      },
    },
  })
}

async function onInstall(data?: Data) {
  if (!data) {
    return
  }
  dialog.open(installExtension, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: data,
      onConfirm: async (params: any) => {
        try {
          const { code, msg } = await API.plugins.userAddPluginToWindowCreate({ ...params, pluginId: data.id })
          if (code === 0) {
            globalThis.electronAPI.send('extension:download', [toRaw(data) as any])
          }
          onlyErrorToast(code, msg)
          tableRef.value?.refresh({ pluginSwitchType: filters.value })
        }
        catch (error) {
          console.log(error)
        }
      },
    },
  })
}

async function getExtensionDetail(pluginId: number) {
  const { data: { rows: [plugin] } } = await API.plugins.userGetPluginInfoByIdList({ pluginId })
  return plugin
}

async function checkUpdate(data: Data[]) {
  const detectable = ([] as Data[]).concat(data).filter(item => item.source !== ExtensionsSource.local || !checkUpdateExtension.value[item.pluginDir!])
  detectable.forEach((item) => {
    checkUpdateExtension.value[item.pluginDir as string] = true
  })
  const results = await concurrentControl(detectable.map(item => () => {
    return API.plugins.userCheckAllPluginsVersionList({ pluginDir: item.pluginDir!, pluginID: item.id! }).then((result) => {
      if (result.code === 0 && result.data) {
        const newItem = result.data.pluginUpdateStates[0]
        item.pluginUpdateState = newItem?.pluginUpdateState ?? item.pluginUpdateState
        item.pluginNewVersion = newItem?.pluginNewVersion ?? item.pluginNewVersion
        item.pluginVersion = newItem?.pluginVersion ?? item.pluginVersion
      }
      return result
    }).finally(() => {
      checkUpdateExtension.value[item.pluginDir as string] = false
    })
  }), 2)
  const updateCount = results.filter((item) => {
    if (item.code === 0 && item.data) {
      return item.data.pluginUpdateStates[0]?.pluginUpdateState === ExtensionsStatus.update
    }
    return false
  }).length

  const message = detectable.length > 1 ? $t('检查更新完成，{count}个扩展有更新', { count: updateCount }) : $t('检查更新完成')
  showToast(0, message)
}

/**
 * !todo 优化交互体验
 */
async function updateExtension(data: Data | Data[]) {
  const task = ([] as Data[])
    .concat(data)
    .filter(item => item.pluginUpdateState === ExtensionsStatus.update)
    .map((item) => {
      Reflect.set(updatingMap.value, item.pluginDir!, true)
      return async () => {
        const { code, msg } = await API.plugins.userUpgradePluginsCreate({ pluginDir: item.pluginDir!, pluginName: item.pluginName!, pluginID: item.id! })
        onlyErrorToast(code, `${item.pluginName}: ${msg}`)
        Reflect.deleteProperty(updatingMap.value, item.pluginDir!)
        return { code, msg }
      }
    })
  await concurrentControl(task, 2)
  filters.resetFilters()
}

async function deleteExtension(datas: Data[]) {
  const { promise, resolve } = Promise.withResolvers<void>()

  confirm.require({
    header: $t('删除扩展'),
    message: $t('您确认要删除所选扩展吗？删除后，所有已关联项目中的窗口扩展将被移除。'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      try {
        const ids = datas.map(item => item.id as number)
        const { code, msg } = await API.plugins.userBatchDelPluginInfoCreate({ ids })
        onlyErrorToast(code, msg)
        if (code === 0) {
          filters.resetFilters()
          globalThis.electronAPI.send('extension:remove', datas.map(item => item.pluginDir!))
        }
      }
      catch (error) {
        onlyErrorToast(-1, error as string)
      }
      finally {
        resolve()
      }
    },
    reject: resolve,
    onHide: resolve,
  })

  return promise
}

function showShieldDialog(data: any) {
  showModal({
    header: $t('扩展安全性检查'),
    class: 'w-480px',
    slots: {
      default: () => <ShieldDialog extensionInfo={data} />,
      footer: undefined,
    },
  })
}

defineExpose({
  refresh: () => {
    tableRef.value?.refresh({ pluginSwitchType: filters.value })
  },
})
</script>

<template>
  <RyTable ref="extable" cache-key="extension-list" scrollable selection-mode="multiple" :table-operation="tableOperation" :table-request="tableRequest" :columns="columns" :show-display="false"
           :show-gridlines="false" :operation-handler="operationHandler"
  >
    <template #filter-after>
      <div class="flex items-start justify-between w-full">
        <RxSelectButton v-model="filters.value" :options="filters.options" size="xxs" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
        <div class="group-button">
          <RxButton size="xxs" icon="base/rx_ic_download_cloud" :label="$t('添加 Google 扩展')" @click.stop="installViaUrl" />
          <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_export" :label="$t('本地上传')" @click.stop="onUploadExtension()" />
        </div>
      </div>
    </template>

    <template #table-empty>
      <CustomNewEmpty icon="base/rx_ic_extension_store" img="empty-extensions.png" :title="$t('暂无扩展')" :desc="$t('在此添加扩展以管理，并更方便地与窗口或项目进行绑定。')">
        <template #extra>
          <div class="flex gap-3">
            <RxButton outlined severity="secondary" size="md" icon="base/rx_ic_magnify" :label="$t('搜索扩展')" @click.stop="$emit('search')" />
            <TutorialVideo video-type="plugin_management" :autoplay="false" />
          </div>
        </template>
      </CustomNewEmpty>
    </template>
    <template #extension="{ data }">
      <div class="flex items-center gap-3 w-75">
        <img class="extension-image" :src="data.pluginIcon">
        <div class="flex flex-col justify-center items-start w-full extension-info">
          <div class="w-full ellipsis-1 extension-info-name">
            {{ data.pluginName }}
          </div>
          <div class="extension-info-version">
            v{{ data.pluginVersion }}
          </div>
        </div>
      </div>
    </template>

    <template #pluginSwitchType="{ data }">
      <div class="plugin-switch-type">
        <span v-if="data.pluginSwitchType === PluginSwitchType.personal">{{ $t('个人') }}</span>
        <span v-else>
          <span>{{ $t('团队') }}</span>
          <SvgIcon v-tooltip.top="{ value: `${data.userName}\n${data.email}`, showDelay: 500 }" class="ml-1" name="base/rx_ic_info" :size="12" color="var(--colors-icon-icon-note)" />
        </span>
      </div>
    </template>

    <template #related="{ data }">
      <div v-if="data.pluginSwitchType === PluginSwitchType.personal || role.isOwner || role.isManager" @click.stop="operationHandler({ name: 'install' }, data)">
        <!-- <RxTag v-if="Number(data.installType) === ExtensionsInstallType.all" icon="base/rx_ic_stack_full" :label="$t('全部安装')" /> -->
        <RelatedInfo class="cursor-pointer" icon="base/rx_ic_stack" :list="data.bindPlugin">
          <template #empty>
            <div class="flex items-center gap-1.5">
              <RxTag class="cursor-pointer" icon="base/rx_ic_stack" />
              <span class="not-installed">{{ $t('尚未安装') }}</span>
            </div>
          </template>
        </RelatedInfo>
      </div>
      <div v-else>
        --
      </div>
    </template>

    <template #update="{ data }">
      <template v-if="checkUpdateExtension[data.pluginDir]">
        <span class="flex items-end gap-1">
          <span>{{ $t('检查中') }}</span>
          <span class="dots" />
        </span>
      </template>
      <template v-else>
        <div v-if="data.pluginUpdateState === ExtensionsStatus.update" class="flex items-center gap-3">
          <RxButton severity="success" icon="base/rx_ic_renew" :loading="updatingMap[data.pluginDir]" :label="$t('更新')" size="xxs" @click.stop="updateExtension(data)" />
          <SvgIcon v-tooltip.top="{ value: `latest: ${data.pluginNewVersion}`, showDelay: 500 }" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
        </div>
        <div v-else class="update-info">
          --
        </div>
      </template>
    </template>

    <template #actions-extra="{ data }">
      <div class="flex items-center">
        <RxButton v-if="data.pluginSwitchType === PluginSwitchType.personal || check('Plugin_Installed_pin_to_toolbar')" v-tooltip.top="{ value: $t('固定'), showDelay: 500 }" text severity="secondary"
                  size="xxs" @click.stop="showPinMenu($event, data)"
        >
          <template #icon>
            <SvgIcon class="block pointer-events-none" :class="{ pinned: data.fixedPlugin === 'pin' }" :name="data.fixedPlugin === 'pin' ? 'base/rx_ic_pin_solid_02' : 'base/rx_ic_pin_line_02'"
                     color="var(--colors-icon-icon-secondary)"
            />
          </template>
        </RxButton>
        <RxButton v-tooltip.top="{ value: $t('安全检查'), showDelay: 500 }" severity="secondary" size="xxs" icon="base/rx_ic_shield" text @click.stop="showShieldDialog(data)" />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.group-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);
}

.extension {
  &-image {
    padding: var(--spacing-md, 6px);
    width: 36px;
    aspect-ratio: 1;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 0.5px solid var(--colors-border-border-subtle, #c7cdd1);
    background: var(--colors-background-bg-block);
  }

  &-info {
    gap: var(--spacing-sm, 4px);
    line-height: var(--Line-Height-text-xs, 16px);
    font-weight: 500;

    &-name {
      color: var(--colors-text-text-primary);
      font-family: Inter;
      font-size: 13px;
    }

    &-version {
      color: var(--colors-text-text-tertiary);
      font-family: 'JetBrains Mono';
      font-size: 12px;
    }
  }
}

.plugin-switch-type,
.update-info {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;

  // &:hover {
  //   color: var(--colors-text-text-brand, #12a3fc);
  // }
}

.not-installed {
  color: var(--colors-text-text-inactive, #a3a9ad);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.pinned {
  color: var(--colors-text-text-brand, #12a3fc);
}

.dots {
  width: 20px;
}

/* 动画效果 */
.dots::after {
  content: '';
  animation: loadingDots 1.5s steps(5, end) infinite;
}

/* 动画关键帧 */
@keyframes loadingDots {
  0% {
    content: '.';
  }

  33% {
    content: '..';
  }

  66% {
    content: '...';
  }

  100% {
    content: '.';
  }
}
</style>
