import { $t } from '/@/locales'

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
      slot: 'related',
    },
    {
      title: $t('操作'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
