import { $t } from "/@/locales"

export function usePlatformForm() {
  const original = ref<any>({})

  function getInputs(data: any = {}) {
    return [
      {
        type: 'select',
        label: $t('平台'),
        name: 'platformUrl',
        value: data.platformUrl,
        props: {
          placeholder: $t('请输入或选择平台网址'),
          optionValue: 'value',
          editable: true,
          filter: true,
          options: [],
          onChange: ({ value, props }: any) => {
            const platform = props.options.find((item: any) => item.value === value)
            Reflect.set(original.value, 'platformIcon', platform?.platformIcon || "")
            Reflect.set(original.value, 'platformIconDark', platform?.platformIconDark || "")
          }
        },
        resolver: (zod: any) => zod.string().url($t('请输入正确的平台网址'))
      },
      {
        type: 'text',
        label: $t('账号'),
        name: 'platformUserName',
        value: data.platformUserName,
        props: {
          placeholder: $t('请输入账号'),
        }
      },
      {
        type: 'password',
        label: $t('密码'),
        name: 'platformPassword',
        value: data.platformPassword,
        props: {
          placeholder: $t('请输入密码'),
        }
      },
      {
        type: 'text',
        label: '2FA',
        name: 'platformEfa',
        value: data.platformEfa,
        props: {
          placeholder: $t('请输入 2FA 密钥'),
        }
      }
    ]
  }
  return { getInputs, original }
}