<script setup lang="ts">
import RemarkIcon from '/@/components/remark-icon'
import { $t } from '/@/locales/index.js'
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useProjectEntityLabels } from '/@/composables/useProjectEntityLabels'
import { isEmptyValue } from '/@/utils'
import { toLabelId, toSubmitLabelIds, useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useRoleStore } from '/@/stores/role'
import { usePermission } from '/@/hooks/usePermission'
import type { WindowMetaData } from './type.ts'

const { isEdit = false, showRemark = true } = defineProps<{
  isEdit?: boolean
  showRemark?: boolean
}>()

const route = useRoute()
const { showMenu: showPopupMenu } = usePopupMenu()
const { isOwner } = storeToRefs(useRoleStore())
const { check } = usePermission()

const { getTags, getProjects, getProjectMember } = useMateGroup()
const profileLabels = useProfileEntityLabels()
const projectLabels = useProjectEntityLabels()

const metaData = defineModel<WindowMetaData>('modelValue')

metaData.value ??= {
  projectName: projectLabels.value.unspecified,
  projectId: undefined,
  labelIds: [],
  windowRemark: '',
  projectDefault: 0,
}

onMounted(async () => {
  if (!isEdit && isEmptyValue(metaData.value!.projectId)) {
    const projects = await getProjects()
    // 优先使用路由传递的 projectId, 非 owner 使用第一个项目
    const targetId = route.query.projectId || (!isOwner.value && projects[0].value)
    const targetProject = projects.find(item => targetId ? item.value === targetId : item.projectDefault)
    if (targetProject) {
      metaData.value!.projectId = targetProject.value
      metaData.value!.projectName = targetProject.label
      metaData.value!.projectDefault = 1
    }
  }
})

async function selectProject(event: MouseEvent) {
  const operation = await getProjects()
  const value = metaData.value!.projectId?.toString()

  showPopupMenu(event, {
    mode: {
      type: 'single',
      value,
      options: operation,
      field: 'value',
    },
    menuProps: {
      onHide: ({ value: projectId }: any) => {
        if (!isEmptyValue(projectId) && projectId !== value) {
          const project = operation.find((item: any) => item.value === projectId)
          metaData.value!.projectId = String(projectId)
          metaData.value!.projectName = project?.label || projectLabels.value.unspecified
          metaData.value!.projectDefault = project?.projectDefault || 0
        }
      },
    },
  })
}

async function selectTags(event: MouseEvent) {
  const value = metaData.value?.labelIds?.map(item => toLabelId(item))
  const [tagList, memberList] = await Promise.all([
    getTags(),
    metaData.value?.projectId ? getProjectMember(metaData.value!.projectId) : Promise.resolve([]),
  ])

  const options = memberList.concat(tagList)
  rememberLabelOptions(options as LabelOption[])
  showPopupMenu(event, {
    mode: {
      type: 'multiple',
      value,
      options,
      field: 'value',
    },
    menuProps: {
      onHide: ({ value: labelIds }: any) => {
        if (!isEq(value, toRaw(labelIds))) {
          metaData.value!.labelIds = toSubmitLabelIds(labelIds)
        }
      },
    },
  })
}

function isEq(oldIds: any, newIds: any) {
  return oldIds.slice().sort().join(',') === newIds.slice().sort().join(',')
}

function onConfirm(windowRemark: string) {
  metaData.value!.windowRemark = windowRemark
}

interface LabelOption {
  value: string
  label?: string
  name?: string
  _origin?: {
    userName?: string
    name?: string
  }
}

/** 已选标签 id → 展示名，供 tooltip 使用 */
const labelNameById = ref(new Map<string, string>())

function optionDisplayName(option: LabelOption) {
  return option.label || option.name || option._origin?.userName || option._origin?.name || ''
}

function rememberLabelOptions(options: LabelOption[]) {
  const next = new Map(labelNameById.value)
  for (const option of options) {
    const name = optionDisplayName(option)
    if (option.value && name) {
      next.set(String(option.value), name)
    }
  }
  labelNameById.value = next
}

let labelNameSeq = 0

/** 编辑回填只有 id，补一次名称；菜单里选过的不再重复请求 */
async function ensureLabelNames() {
  const ids = metaData.value?.labelIds ?? []
  if (!ids.length || ids.every(id => labelNameById.value.has(toLabelId(id)))) {
    return
  }

  const seq = ++labelNameSeq
  const [tagList, memberList] = await Promise.all([
    getTags(),
    metaData.value?.projectId ? getProjectMember(metaData.value.projectId) : Promise.resolve([]),
  ])
  if (seq !== labelNameSeq) {
    return
  }
  rememberLabelOptions([...(memberList as LabelOption[]), ...(tagList as LabelOption[])])
}

watch(
  () => [metaData.value?.projectId, ...(metaData.value?.labelIds ?? [])],
  () => {
    void ensureLabelNames()
  },
  { immediate: true },
)

/** 未指定项目不算已选，和标签未选中一样不显示角标 */
const projectSelected = computed(() => {
  const name = metaData.value?.projectName?.trim() ?? ''
  return !isEmptyValue(metaData.value?.projectId) && !!name && name !== projectLabels.value.unspecified
})

const projectTooltip = computed(() => projectSelected.value ? metaData.value!.projectName! : projectLabels.value.entity)

const tagTooltip = computed(() => {
  const ids = metaData.value?.labelIds ?? []
  if (!ids.length) {
    return $t('标签')
  }
  const names = ids.map(id => labelNameById.value.get(toLabelId(id))).filter(Boolean)
  return names.length ? names.join('、') : $t('标签')
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div v-tooltip.top="projectTooltip" class="flex items-center position-relative" :class="{ selected: projectSelected }">
      <RxButton class="!min-w-auto" :disabled="!check('Profiles_move_project')" outlined severity="secondary" icon="base/rx_ic_stack" @click="selectProject" />
    </div>
    <div v-tooltip.top="tagTooltip" class="flex items-center position-relative" :class="{ selected: metaData?.labelIds?.length }">
      <RxButton class="!min-w-auto" :disabled="!check('Profiles_select_label')" outlined severity="secondary" icon="base/rx_ic_tag" @click="selectTags" />
    </div>
    <RemarkIcon v-if="showRemark" hide-label :disabled="!check('Profiles_edit_remark')" :title="profileLabels.addRemarkTitle" :label="$t('备注')" mode="button" :value="metaData?.windowRemark"
                :on-confirm="onConfirm"
    />
  </div>
</template>

<style lang="scss" scoped>
.selected::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 8px;
  transform: translate(30%, -30%);
  background-color: red;
  border-radius: 50%;
  z-index: 99;
}
</style>
