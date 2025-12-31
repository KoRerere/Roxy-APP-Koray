<script setup lang="tsx">
import RxAvatar from "/@/components/rx-avatar";
import type { UnwrapRowsType, UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api';
import { RxSvgIcon } from '/@/components/rx-icon'
import { getRoleLabelMap, Role } from '/@/enums';
import { useWorkspaceStore } from '/@/stores/workspace';
import { useDialog } from '/@/hooks/useDialog';
import { useResponseToast } from '/@/hooks/useResponseToast'
import WorkspaceSetting from '/@/views/workspace-setting/index.vue'
;
import { usePopupMenu } from '/@/hooks/usePopupMenu';
import { copyText } from '/@/utils/'

type Data = UnwrapRowType<UserGetWorkspaceListListData>

const { list = [] } = defineProps<{
  list: UnwrapRowsType<UserGetWorkspaceListListData>,
  type?: 'owner' | 'member'
}>()

const emit = defineEmits(['enterWorkspace'])

const [showModal] = useDialog()
const workspaceStore = useWorkspaceStore()
const { currentWorkspace } = storeToRefs(workspaceStore)
const roleLabelMap = getRoleLabelMap()
const { showMenu: showPopupMenu } = usePopupMenu()
const [showToast] = useResponseToast()

function getAvatarProps(item: Data) {
  return {
    name: item.workspacePicture || item.workspaceName?.slice(0, 2),
    color: item.workspacePicture ? 'var(--pattern-topnav-space-emoji-bg)' : 'var(--pattern-topnav-space-avatar-bg)',
    size: 48,
    fontSize: item.workspacePicture ? 32 : 28,
    radius: '6px',
  }
}

function showEditWorkspaceDialog(workspaceInfo: Data) {
  showModal({
    header: $t('编辑工作空间'),
    class: 'w-[520px]',
    slots: {
      default: ({ handleCancel }) => {
        function handleLeaveWorkspace({ isCurrentWorkspace, id }: { isCurrentWorkspace: boolean, id?: number }) {
          // 如果离开/删除的是当前空间，则需要进入其他空间
          handleCancel()
          if (isCurrentWorkspace) {
            enterWorkspace({ id })
          }
        }

        return <WorkspaceSetting
          workspaceInfo={workspaceInfo}
          onDelete={handleLeaveWorkspace}
          onSave={handleCancel}
          onLeave={handleLeaveWorkspace} />
      },
      footer: undefined
    },
  })
}

async function enterWorkspace(item: Data) {
  item.id && workspaceStore.setCurrentWorkspace(item.id)
  emit('enterWorkspace')
}

function onConfig(event: MouseEvent, item: Data) {
  showPopupMenu(event, {
    model: [
      {
        label: $t('复制空间 ID'),
        icon: 'base/rx_ic_copy',
        command: () => {
          copyText(item.workspaceNo!.toString())
          showToast(0, $t('复制成功'))
        },
      },
      {
        label: $t('编辑空间'),
        icon: 'base/rx_ic_edit',
        command: () => {
          showEditWorkspaceDialog(item)
        },
      },
    ]
  })
}
</script>

<template>
  <div v-if="list.length > 0" class="workspace-list">
    <template v-for="item in list" :key="item.id">
      <div class="workspace-item">
        <div class="workspace-item-info">
          <RxAvatar v-bind="getAvatarProps(item)" />
          <div class="workspace-item-detail">
            <div class="detail-header">
              <div class="workspace-name" v-tooltip.top="item.workspaceName">
                {{ item.workspaceName }}
              </div>
              <div v-if="item.workspaceDefault && item.role === Role.OWNER" class="default-workspace">
                <RxSvgIcon name="base/rx_ic_house" :size="16" />
                {{ $t('Default') }}
              </div>
              <div v-if="type === 'member'" class="badge">
                {{ roleLabelMap[item.role as keyof typeof roleLabelMap] }}
              </div>
            </div>
            <div v-if="type !== 'member'" class="detail-footer">
              {{ $t('窗口已用量: ') }} {{ item.useWindowCount }}
              <div class="divide"></div>
              {{ $t('成员: ') }} {{ item.useMemberCount }}
            </div>
          </div>
        </div>
        <div class="workspace-item-actions">
          <RxButton severity="secondary" outlined size="md" :disabled="item.id === currentWorkspace?.id" @click="enterWorkspace(item)">
            {{ item.id === currentWorkspace?.id ? $t('当前空间') : $t('进入空间') }}
          </RxButton>
          <RxButton severity="secondary" outlined size="md" icon="base/rx_ic_gear" @click="onConfig($event, item)">
            <template #icon>
              <div class="p-[2px] flex-cc">
                <RxSvgIcon name="base/rx_ic_gear" />
              </div>
            </template>
          </RxButton>
        </div>
      </div>
    </template>
  </div>
  <div v-else class="empty-workspace">
    {{ $t('您暂未加入任何工作空间') }}
  </div>
</template>

<style lang="scss" scoped>
.workspace-list {
  display: flex;
  flex-direction: column;

  .workspace-item {
    display: flex;
    padding: 12px 0px;
    justify-content: space-between;
    align-items: center;
    align-self: stretch;
    border-bottom: 1px solid var(--colors-border-divider);

    &:last-of-type {
      border-bottom: none;
    }

    .workspace-item-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-xl, 12px);

      .workspace-item-detail {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        gap: 8px;
      }

      .detail-header {
        display: flex;
        align-items: center;
        gap: 10px;

        .badge {
          display: flex;
          min-width: 24px;
          padding: 2px var(--spacing-lg, 8px);
          justify-content: center;
          align-items: center;
          gap: var(--spacing-none, 0px);
          border-radius: 40px;
          border: 0.5px solid var(--component-tag-border, #E4E8EB);
          background: var(--component-tag-bg, #F0F3F5);
          color: var(--component-tag-text, #575D61);
          font-family: Inter;
          font-size: 12px;
          font-style: normal;
          font-weight: 400;
          line-height: var(--Line-Height-text-xs, 16px);
        }
      }

      .workspace-name {
        color: var(--colors-text-text-primary, #FAFAFA);
        font-family: Inter;
        font-size: 16px;
        font-style: normal;
        font-weight: 600;
        line-height: normal;
        max-width: 256px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .default-workspace {
        display: flex;
        padding: var(--spacing-xs, 2px) var(--spacing-none, 0px);
        align-items: center;
        gap: var(--spacing-sm, 4px);
        color: var(--color-yellow-400, #DB8D1A);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: 14px;
      }

      .divide {
        width: 1px;
        height: 12px;
        background: var(--colors-border-border-base, #c7cdd1);
      }

      .detail-footer {
        display: flex;
        align-items: center;
        gap: var(--spacing-lg, 8px);
        color: var(--colors-text-text-tertiary, #A3A9AD);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 400;
        line-height: var(--Line-Height-text-xs, 16px);
      }
    }

    .workspace-item-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }
}

.empty-workspace {
  display: flex;
  padding: 32px 0px;
  justify-content: center;
  align-items: center;
  align-self: stretch;
  color: var(--colors-text-text-inactive, #A3A9AD);
  text-align: center;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
}
</style>
