<script setup lang="tsx">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api/'
import { RxSvgIcon } from '/@/components/rx-icon'
import { getRoleLabelMap, Role } from '/@/enums/'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import WorkspaceForm from '/@/views/workspace-setting/workspace-form.vue'
import { useUserStore } from '/@/stores/user'
import { I18nT } from 'vue-i18n'
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { emitter } from '/@/utils/eventBus'

const userStore = useUserStore()
const roleLabelMap = getRoleLabelMap()
const workspaceStore = useWorkspaceStore()
const { currentWorkspace, workspaceList, defaultWorkspace } = storeToRefs(workspaceStore)
const [workspaceFormDialog] = useDialog()
const [dialogInstance] = useDialog()
const toast = useToast()
const outerMaxCreateWindowCount = ref<undefined | number>(undefined)

emitter.on('maxWindowCountChange', (val) => {
  outerMaxCreateWindowCount.value = val
})

/** 实时剩余的窗口额度 */
const maxCreateWindowCount = computed(() => {
  return outerMaxCreateWindowCount.value === undefined ? workspaceStore.getMaxCreateWindowCount(0) : outerMaxCreateWindowCount.value
})

const workspaceFormRef = ref<InstanceType<typeof WorkspaceForm>>()
const workspaceForm = ref({
  workspaceName: '',
  workspacePicture: '',
  maxWindowCount: 0,
})

function showOutOfCreateWorkspaceErrorDialog() {
   // 超出总额度
   dialogInstance.showModal({
      header: $t('可创建的工作空间数量不足'),
      class: 'w-[380px]',
      okText: $t('好的'),
      slots: {
        default: () =>
          <I18nT tag="div" keypath={$t('您当前最多只能创建最多{count}个工作空间，请删除不常用的工作空间后再新建。', { count: '{count}' })}>
            {{ count: userStore.userInfo.maxWorkspaceCount }}
          </I18nT>
      },
    })
}

function showFirstCreateTipsDialog() {
  dialogInstance.showModal({
    header: $t('Roxy工作空间说明'),
    class: 'w-[380px]',
    okText: $t('好的'),
    slots: {
      default: () => <div>
        <div>{$t('欢迎体验新一代指纹浏览器协作模式！')}</div>
        <div>{$t('在1个Roxy的工作空间中，您即可完成传统指纹浏览器中所有团队协作需求。')}</div>
        <div>{$t('通过构建新的工作空间，您可以与更多互联网上的用户进行协作并灵活切换。')}</div>
        <div>{$t('在新的空间中，一切都是独立的，您可以重新分配并配置该空间的专用资源、团队结构等。')}</div>
        <div>{$t('在不久的将来，Roxy将为跨空间转移资源提供多种支持，以更好地帮助您进行业务流转。')}</div>
      </div>,
    },
  })
}

function showCreateWorkspaceDialog() {
  // if (workspaceList.length === 0) {
   return showFirstCreateTipsDialog()
  // }
  if (userStore.userInfo.maxWorkspaceCount - userStore.userInfo.useWorkspaceCount <= 0) {
    showOutOfCreateWorkspaceErrorDialog()
    return
  }


  return workspaceFormDialog.showModal({
    header: $t('创建新的工作空间'),
    class: 'w-[500px]',
    slots: {
      default: () => <WorkspaceForm ref={workspaceFormRef} v-model:workspaceInfo={workspaceForm.value} operationType='create'/>,
    },
    async handleOk() {
      workspaceFormRef.value?.onInput()
      if (workspaceFormRef.value?.errorMessage) {
        return Promise.reject(new Error('表单校验失败'))
      }

      const { code, data, msg } = await API.limit.userAddWorkspaceInfoCreate(workspaceForm.value)
      if (code === 0) {
        console.log(data)
        workspaceStore.getWorkspaceList()
        userStore.fetchUserInfo()
        workspaceForm.value.workspaceName = ''
        workspaceForm.value.workspacePicture = ''
        workspaceForm.value.maxWindowCount = 0
      } else if(code === 407) {
        showOutOfCreateWorkspaceErrorDialog()
        return Promise.reject(new Error(msg))
      } else if (code === 409) {
        dialogInstance.showModal({
          header: $t('各空间可创建总量大于账号本身的限额'),
          class: 'w-[380px]',
          okText: $t('好的'),
          slots: {
            default: () => <div>
              <div>{$t('您在其他工作空间的可创建窗口数加上当前设置的窗口数，已超过账号本身的可创建窗口的最大值。')}</div>
              <div>{$t('当前操作无法继续，请调整后再保存。')}</div>
            </div>,
          },
        })
        return Promise.reject(new Error(msg))
    }
      else {
        console.log(msg)
        toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
        return Promise.reject(new Error(msg))
      }
    },
  })
}

function getAvatarStyle(workspacePicture: string) {
  return workspacePicture ? {} : { backgroundColor: '#000', color: '#fff', fontSize: '14px' }
}

function getMaxWindowCount(workspaceItem: UnwrapRowType<UserGetWorkspaceListListData>) {
  if (workspaceItem.role === Role.OWNER && workspaceItem.workspaceDefault) {
    return workspaceItem.maxWindowCount - maxCreateWindowCount.value
  }
  return workspaceItem.maxWindowCount
}
</script>

<template>
  <div v-if="currentWorkspace" class="workspace">
    <Select v-model="currentWorkspace" :options="workspaceList" option-label="name" class="workspace-select"
      :overlay-class="$style['workspace-select-overlay']" @show="workspaceStore.fetchWorkspaceList">
      <template #value="slotProps">
        <Avatar :label="slotProps.value.workspacePicture || slotProps.value.workspaceName.slice(0, 2)"
          class="workspace-icon-small" :style="getAvatarStyle(slotProps.value.workspacePicture)" />
        <span class="workspace-name">{{ slotProps.value.workspaceName }}</span>
      </template>
      <template #option="slotProps">
        <Avatar :label="slotProps.option.workspacePicture || slotProps.option.workspaceName.slice(0, 2)"
          class="workspace-icon" :style="getAvatarStyle(slotProps.option.workspacePicture)" />

        <div>
          <span class="workspace-name">{{ slotProps.option.workspaceName }}</span>
          <div class="workspace-usage">
            <RxSvgIcon name="base/rx_ic_profile_sm" size="14px" />
            <span class="usage">
              <template v-if="slotProps.option.role === Role.OWNER && slotProps.option.workspaceDefault">
                <i18n-t :keypath="$t('剩余可分配用量：{count}个', { count: '{count}' })" scope="global">
                  <template #count>
                    {{ maxCreateWindowCount }}
                  </template>
                </i18n-t>
              </template>
              <template v-else>
                {{ $t('用量：') }}{{ slotProps.option.useWindowCount }}/{{ getMaxWindowCount(slotProps.option) }}
              </template>
            </span>
          </div>
        </div>
        <span v-if="slotProps.option.role !== Role.OWNER" class="role-tag">
          <RxSvgIcon name="base/rx_ic_internet" :size="12" />
          {{ roleLabelMap[slotProps.option.role] }}
        </span>
        <RxSvgIcon v-if="currentWorkspace.id === slotProps.option.id" class="check-icon" name="base/rx_ic_check"
          :size="16" />
      </template>
      <template #footer>
        <div class="select-footer" @click="showCreateWorkspaceDialog">
          <RxSvgIcon name="base/rx_ic_plus" />
          <span>{{ $t('创建新的工作空间') }}</span>
        </div>
      </template>
    </Select>
  </div>
</template>

<style lang="scss" module>
.workspace-select-overlay {
  :global(.p-select-list-container) {
    min-width: 270px;
  }


  :global(.p-select-option) {
    display: flex;
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 10px;
    align-items: center;
    gap: var(--spacing-md, 6px);
    align-self: stretch;
    border-radius: var(--radius-sm, 4px);
    background: var(--Colors-Background-bg-body, #fff);
  }
}
</style>

<style lang="scss" scoped>
.workspace {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);

  .workspace-select {
    width: unset;
    border: none;
    background-color: transparent;
    box-shadow: none;

    :deep(.p-select-list-container) {
      border-bottom: 1px solid var(--Colors-Border-border-container, #c7cdd1);
    }

    :deep(.p-select-label) {
      display: flex;
      padding: var(--spacing-sm, 4px) var(--spacing-md, 6px) var(--spacing-sm, 4px) var(--spacing-sm, 4px);
      align-items: center;
      gap: var(--spacing-md, 6px);
      padding-right: 0;
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      /* 133.333% */

      img {
        display: flex;
        width: 20px;
        height: 20px;
        flex-direction: column;
        justify-content: center;
        flex-shrink: 0;
      }


    }
  }
}

.select-footer {
  cursor: pointer;
  display: flex;
  padding: 10px var(--spacing-md, 6px) 10px 10px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  border-top: 1px solid var(--Colors-Border-border-container, #C7CDD1);
  background: var(--Colors-Background-bg-body, #fff);

  span {
    flex: 1 0 0;
    color: #000;
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 123.077% */
  }
}

.role-tag {
  display: flex;
  padding: var(--spacing-xs, 2px) var(--spacing-sm, 4px);
  align-items: center;
  gap: var(--spacing-xs, 2px);
  border-radius: 25px;
  color: var(--Color-yellow-400, #db8d1a);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 14px;
  /* 140% */
}

.workspace-icon {
  width: 32px;
  height: 32px;
  color: #FFF;
  text-align: center;
  font-family: "JetBrains Mono";
  font-size: 20px !important;
  font-style: normal;
  font-weight: 700;
  line-height: 20px;
  /* 160% */
  letter-spacing: -0.4px;
  text-transform: uppercase;
}

.workspace-icon-small {
  display: flex;
  align-items: center;
  width: 20px;
  height: 20px;
  text-transform: uppercase;
  color: #FFF;
  text-align: center;
  font-family: "JetBrains Mono";
  font-size: 13px !important;
  font-style: normal;
  font-weight: 700;
  line-height: 13px;
  /* 153.846% */
  letter-spacing: -0.26px;
}

.workspace-name {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

.workspace-usage {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--Colors-Text-text-secondary, #575D61);

}

.usage {
  color: var(--Colors-Text-text-secondary, #575D61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */
}

.check-icon {
  margin-left: auto;
  color: #12A3FC
}
</style>
