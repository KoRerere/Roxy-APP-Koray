<script setup lang="ts">
import RemarkIcon from '/@/components/remark-icon'
import { $t } from '/@/locales/index.js'
import { isEmptyValue } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { usePopoverMenu } from '/@/views/browser/list/profiles/components/popover-menu'
import type { MetaData } from './type.ts'

const route = useRoute()
const [showMenu] = usePopoverMenu()

const { getTags, getProjects, getProjectMember } = useMateGroup()

const metaData = defineModel<MetaData>('modelValue', {
  default: {
    projectName: $t('未指定项目'),
    projectId: undefined,
    labelIds: [],
    windowRemark: '',
    projectDefault: 0,
  },
})

onMounted(async () => {
  if (isEmptyValue(metaData.value.projectId)) {
   const projects = await getProjects()
   const routeProject = projects.find(item => item.value === route.query.projectId)
   const defaultProject = routeProject || projects.find(item => item.projectDefault)
    if (defaultProject) {
      metaData.value.projectId = Number(defaultProject.value)
      metaData.value.projectName = defaultProject.label
      metaData.value.projectDefault = 1
    }
  }
})

async function selectProject(event: Event) {
  const operation = await getProjects()
  const value = metaData.value.projectId?.toString()

  showMenu(event, {
    type: 'radio',
    value,
    operation,
    onHide: (projectId: string) => {
      if (!isEmptyValue(projectId) && projectId !== value) {
        const project = operation.find((item: any) => item.value === projectId)
        metaData.value.projectId = Number(projectId)
        metaData.value.projectName = project?.label || $t('未指定项目')
        metaData.value.projectDefault = project?.projectDefault || 0
      }
    },
  })
}

async function selectTags(event: Event) {
  const value = metaData.value?.labelIds?.map((item: any) => `${item}`)
  const [tagList, memberList] = await Promise.all([
    getTags(),
    metaData.value?.projectId ? getProjectMember(metaData.value.projectId) : Promise.resolve([]),
  ])

  showMenu(event, {
    type: 'checkbox',
    value,
    operation: memberList.concat(tagList),
    onHide: (labelIds: string[]) => {
      if (!isEq(value, toRaw(labelIds))) {
        metaData.value.labelIds = (labelIds || []).map(value => value.startsWith('u_') ? value : Number(value))
      }
    },
  })
}

function isEq(oldIds: any, newIds: any) {
  return oldIds.slice().sort().join(',') === newIds.slice().sort().join(',')
}

function onConfirm(windowRemark: string) {
  metaData.value.windowRemark = windowRemark
}
</script>

<template>
  <div class="flex items-center gap-2">
    <RxButton outlined severity="secondary" size="sm" icon="base/rx_ic_stack" :label="metaData.projectName" @click="selectProject" />
    <div class="position-relative" :class="{ selected: metaData?.labelIds?.length }">
      <RxButton outlined severity="secondary" size="sm" icon="base/rx_ic_tag" :label="$t('标签')" @click="selectTags" />
    </div>
    <RemarkIcon :title="$t('请为窗口添加备注')" :label="$t('备注')" mode="button" :value="metaData.windowRemark" :on-confirm="onConfirm" />
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
