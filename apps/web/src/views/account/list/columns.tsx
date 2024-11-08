import RelatedInfo from '/@/components/related-info.vue'
import { setColumns, useColumns } from '/@/hooks/useColumns'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'

export function getRawColumns(options?: any) {
  const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3)
  return setColumns([
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
      key: 'actions',
      style: 'width: 9rem',
      slot: 'actions',
    },
  ], options)
}

export function getColumns(options?: any) {
  const rawColumns = getRawColumns(options)
  const [columns] = useColumns({
    key: 'account.list',
    data: rawColumns,
  })
  return columns
}
