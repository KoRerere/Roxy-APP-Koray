import { $t } from "/@/locales"

export const useColumns = () => {
  return [
    {
      title: $t('邮箱'),
      key: 'email',
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
