<script setup lang="ts">
import RemarkIcon from '/@/components/remark-icon'
import { $t } from '/@/locales/index.js'
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useProjectEntityLabels } from '/@/composables/useProjectEntityLabels'
import { isEmptyValue } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
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
      metaData.value!.projectId = Number(targetProject.value)
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
          metaData.value!.projectId = Number(projectId)
          metaData.value!.projectName = project?.label || projectLabels.value.unspecified
          metaData.value!.projectDefault = project?.projectDefault || 0
        }
      },
    },
  })
}

async function selectTags(event: MouseEvent) {
  const value = metaData.value?.labelIds?.map((item: any) => `${item}`)
  const [tagList, memberList] = await Promise.all([
    getTags(),
    metaData.value?.projectId ? getProjectMember(metaData.value!.projectId) : Promise.resolve([]),
  ])

  showPopupMenu(event, {
    mode: {
      type: 'multiple',
      value,
      options: memberList.concat(tagList),
      field: 'value',
    },
    menuProps: {
      onHide: ({ value: labelIds }: any) => {
        if (!isEq(value, toRaw(labelIds))) {
          metaData.value!.labelIds = (labelIds as string[] || []).map(value => value.startsWith('u_') ? value : Number(value))
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
</script>

<template>
  <div class="flex items-center gap-2">
    <RxButton :disabled="!check('Profiles_move_project')" outlined severity="secondary" icon="base/rx_ic_stack" :label="metaData?.projectName" @click="selectProject" />
    <div class="flex items-center position-relative" :class="{ selected: metaData?.labelIds?.length }">
      <RxButton :disabled="!check('Profiles_select_label')" outlined severity="secondary" icon="base/rx_ic_tag" :label="$t('标签')" @click="selectTags" />
    </div>
    <RemarkIcon v-if="showRemark" :disabled="!check('Profiles_edit_remark')" :title="profileLabels.addRemarkTitle" :label="$t('备注')" mode="button" :value="metaData?.windowRemark"
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
