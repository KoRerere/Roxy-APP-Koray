import InputText from 'primevue/inputtext'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useCommonUtil } from '/@/layout/components/header/profile/components/settings-popup/useCommonUtil'

import UploadAvatar from '../upload-avatar.vue'
import ThirdAccount from './components/third-account.vue'
import { oauth2LoginMap, useOauth2Callback } from '/@/utils'
import type { Items, SettingsModule } from '/@/layout/components/header/profile/type'

export function useUserProfilePanel() {
  const { userStore, updateUserName, showToast, onlyErrorToast } = useCommonUtil()
  const { fetchUserInfo } = userStore
  const currentData = ref({} as Recordable<any>)

  // 处理第三方账号登录
  useOauth2Callback(async (params) => {
    const { api } = params
    const { code, msg } = await api()

    if (code === 0) {
      updateUserBindEmailList()
      showToast(0, $t('第三方账号绑定成功'))
    }
    else {
      showToast(code, msg)
    }
  })

  async function updateAvatar(item: Items) {
    const { code, msg } = await API.base.userUploadAvatarCreate({
      avatar: item.value,
    })
    onlyErrorToast(code, msg)
    if (code === 0) {
      const { code, data } = await fetchUserInfo()
      if (code !== 0)
        return
      Reflect.set(userStore.userInfo, 'avatar', data.avatar)
    }
  }

  async function updateUserBindEmailList() {
    const { code, data } = await API.base.userBindEmailListList()

    if (code === 0) {
      Object.assign(currentData.value, Object.fromEntries(data.map(item => [
        `tp_${item.bindType.toLowerCase()}`,
        item.bindType.toLowerCase() === 'google' ? item.thirdEmail : item.thirdUserName,
      ])))
    }
  }

  async function getUserProfilePanels(data?: any): Promise<SettingsModule> {
    Object.assign(currentData.value, data)

    await updateUserBindEmailList()

    return {
      title: $t('个人信息'),
      description: $t('设置您的账号信息和邮箱'),
      list: [
        {
          subtitle: $t('基础信息'),
          items: [
            {
              label: $t('个人头像'),
              text: $t('推荐尺寸为 64*64，最大不超过 2MB'),
              name: 'avatar',
              classes: 'flex-col !items-start gap-4',
              value: currentData.value?.avatar ?? '',
              props: {
                class: 'resize-none w-full',
              },
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <UploadAvatar
                    {...item.props}
                    {...props}
                    onChange={() => updateAvatar(item)}
                  />
                )
              },
            },
            {
              label: $t('用户名'),
              name: 'userName',
              value: currentData.value?.userName ?? '',
              oldValue: currentData.value?.userName,
              component: ({ item, ...props }: { item: Items, props: any }) => {
                return (
                  <InputText
                    {...item.props}
                    {...props}
                    class="!w-0 flex-1"
                    type="text"
                    onBlur={() => updateUserName(item)}
                  />
                )
              },
            },
          ],
        },
        {
          subtitle: $t('第三方账号'),
          items: [
            {
              name: 'Google',
              value: currentData.value?.tp_google ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_google" />
                    <span>Google</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_google} bindType="Google" onBind={oauth2LoginMap.google} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'Github',
              value: currentData.value?.tp_github ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_github" />
                    <span>Github</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_github} bindType="Github" onBind={oauth2LoginMap.github} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'Facebook',
              value: currentData.value?.tp_facebook ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_facebook" />
                    <span>Facebook</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_facebook} bindType="Facebook" onBind={oauth2LoginMap.facebook} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'VK',
              value: currentData.value?.tp_vk ?? '',
              label: () => {
                return (
                  <div class="flex items-center gap-2">
                    <RxSvgIcon name="websites/rx_site_vk" />
                    <span>VK (ВКонтакте)</span>
                  </div>
                )
              },
              component: () => {
                return <ThirdAccount value={currentData.value?.tp_vk} bindType="VK" onBind={oauth2LoginMap.vk} onUnbind={updateUserBindEmailList} />
              },
            },
          ],
        },
      ],
    }
  }

  return {
    getUserProfilePanels,
  }
}
