import RelatedInfo from '/@/components/related-info.vue'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'

const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3)

const columnsConfig = {
  key: 'account.list',
  data: [
    {
      title: $t('账号信息'),
      key: 'status',
      disabledToggle: true,
      slot: 'platform',
    },
    {
      title: $t('备注'),
      key: 'remark',
      slot: 'remark',
    },
    {
      title: $t('已关联窗口'),
      key: 'related',
      render: ({ data }: any) => {
        const list = data.window_info.map((id: number) => `${workspaceName}-${id}`)

        return <RelatedInfo list={list}></RelatedInfo>
      },
    },
    {
      title: $t('操作'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
