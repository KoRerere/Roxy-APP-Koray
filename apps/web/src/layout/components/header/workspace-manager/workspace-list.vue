<script setup lang="tsx">
import type { UnwrapRowsType, UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api';
import { RxSvgIcon } from '/@/components/rx-icon'
import { getRoleLabelMap, Role } from '/@/enums';
import { useWorkspaceStore } from '/@/stores/workspace';
import { useDialog } from '/@/hooks/useDialog';
import { useResponseToast } from '/@/hooks/useResponseToast'
import WorkspaceSetting from '/@/views/workspace-setting/index.vue'
import { $t } from '/@/locales';
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

function getAvatarStyle(workspacePicture: string) {
  return workspacePicture ? {} : { backgroundColor: '#000', color: '#fff', fontSize: '14px' }
}

function showEditWorkspaceDialog(workspaceInfo: Data) {
  showModal({
    header: $t('编辑工作空间'),
    class: 'w-[520px]',
    slots: {
      default: ({ handleCancel }) => {
        function handleLeaveWorkspace({ isCurrentWorkspace }: { isCurrentWorkspace: boolean }) {
          // 如何离开的是当前空间，则需要进入其他空间
          handleCancel()
          if (isCurrentWorkspace) {
            emit('enterWorkspace')
          }
        }

        return <WorkspaceSetting
          workspaceInfo={workspaceInfo}
          onDelete={handleCancel}
          onSave={handleCancel}
          onLeave={handleLeaveWorkspace} />
      },
      footer: undefined
    },
  })
}

async function enterWorkspace(item: Data) {
  workspaceStore.setCurrentWorkspace(item.id!)
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
          <Avatar :label="item.workspacePicture || item.workspaceName?.slice(0, 2)" class="workspace-icon"
            :style="getAvatarStyle(item.workspacePicture)"
            :pt="{ label: item.workspacePicture ? 'text-[32px]' : 'text-[34px]' }" />
          <div class="workspace-item-detail">
            <div class="detail-header">
              <div class="workspace-name">
                {{ item.workspaceName }}
              </div>
              <div v-if="item.workspaceDefault && item.role === Role.OWNER" class="default-workspace">
                <RxSvgIcon name="base/rx_ic_house" :size="16" />
                {{ $t('Default') }}
              </div>
              <div v-if="type === 'member'" class="badge">
                {{ roleLabelMap[item.role] }}
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
          <RxButton severity="secondary" outlined size="md" :disabled="item.id === currentWorkspace?.id"
            @click="enterWorkspace(item)">
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
    border-bottom: 1px solid var(--Colors-Border-border-subtle, #e4e8eb);

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
          border: 0.5px solid var(--Component-Colors-Tag-border, #E4E8EB);
          background: var(--Component-Colors-Tag-bg, #F0F3F5);
          color: var(--Component-Colors-Tag-text, #575D61);
          font-family: Inter;
          font-size: 12px;
          font-style: normal;
          font-weight: 400;
          line-height: var(--Line-Height-text-xs, 16px);
        }
      }

      .workspace-icon {
        width: 48px;
        height: 48px;
        color: #fff;
        text-align: center;
        font-family: 'JetBrains Mono';
        font-size: 20px !important;
        font-style: normal;
        font-weight: 700;
        line-height: 20px;
        letter-spacing: -0.4px;
        text-transform: uppercase;
      }

      .workspace-name {
        color: #000;
        font-family: Inter;
        font-size: 16px;
        font-style: normal;
        font-weight: 600;
        line-height: normal;
      }

      .default-workspace {
        display: flex;
        padding: var(--spacing-xs, 2px) var(--spacing-none, 0px);
        align-items: center;
        gap: var(--spacing-sm, 4px);
        color: var(--Color-yellow-400, #db8d1a);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: 14px;
      }

      .divide {
        width: 1px;
        height: 12px;
        background: var(--Colors-Border-border-container, #c7cdd1);
      }

      .detail-footer {
        display: flex;
        align-items: center;
        gap: var(--spacing-lg, 8px);
        color: var(--Colors-Text-text-inactive, #A3A9AD);
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
  color: var(--Colors-Text-text-inactive, #A3A9AD);
  text-align: center;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
}
</style>
