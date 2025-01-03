import { defineFormSchema } from '/@/components/rx-form'
import { $t } from '/@/locales'
import styles from './schemas.module.css'

export const redeemFormSchemas = defineFormSchema([
  {
    field: 'inviteCode',
    component: 'InputText',
    description: () => <div class={styles.description}>
      {$t('特权码可以提升相应的账号权益，您可以关注Roxy相关社群动态以获取。')}
    </div>,
    componentProps: {
      placeholder: $t('邀请码'),
    },
    rule: {
      trigger: 'blur',
      validator(zod) {
        return zod.string()
          .min(1, $t('请输入邀请码'))
      },
    },
  },
])
