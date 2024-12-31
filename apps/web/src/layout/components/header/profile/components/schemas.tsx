import { defineFormSchema } from '/@/components/rx-form'
import { $t } from '/@/locales'
import styles from './schemas.module.css'

export const redeemFormSchemas = defineFormSchema([
  {
    field: 'inviteCode',
    component: 'InputText',
    description: () => <div class={styles.description}>
      {$t('特权码能提高您的创建额度。获取特权码的途径请关注我们的社群动态，或者联系我们。')}
    </div>,
    componentProps: {
      placeholder: 'Code',
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
