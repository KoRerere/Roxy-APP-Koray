import { $t } from "/@/locales"

export const useColumns = () => {
  return [
    {
      title: $t('邮箱'),
      key: 'email',
      render: ({ data }: any) => {
        const email = data.email
        const atIndex = email.indexOf('@')
        const start = email.slice(0, 2)
        const end = email.slice(atIndex)
        const middle = '*'.repeat(6)

        return (
          <div class="text-[12px]">{start + middle + end}</div>
        )
      },
    },
    {
      title: $t('来源'),
      key: 'source',
    },
    {
      title: $t('日期'),
      key: 'createTime',
    },
  ]
}
