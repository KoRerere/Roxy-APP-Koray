import RxAvatar from '/@/components/rx-avatar'
import { $t } from '/@/locales'

const columnsConfig = {
  key: 'project.list',
  data: [
    {
      title: $t('项目信息'),
      key: 'projectName',
      slot: 'projectName',
    },
    {
      title: $t('成员'),
      render: ({ data }: any) => {
        const list = data.user_info.map((item: any) => ({
          avatar: item.avatar,
          name: item.userName.slice(0, 2),
          color: item.avatarColor,
        }))

        return (
          <RxAvatar list={list} size={28} font-size={14} />
        )
      },
    },
    {
      title: $t('其他'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
