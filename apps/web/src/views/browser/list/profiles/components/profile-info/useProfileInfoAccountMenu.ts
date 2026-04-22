import { h, unref } from 'vue'
import type { MaybeRef } from 'vue'
import AccountCreate from '/@/views/account/create/quick.vue'
import AccountEdit from '/@/views/account/create/batch-edit.vue'
import AccountList from '/@/views/account/list/quick.vue'
import { API } from '/@/api'
import { ProfileModifyType, ProfileReqType } from '/@/enums'
import { silentUpdateAccount } from '../util'

export function useProfileInfoAccountMenu(options: {
  data: MaybeRef<Record<string, any>>
  workspaceName: MaybeRef<string | undefined>
  drawerInstance: ReturnType<typeof import('/@/hooks/useDrawer')['useDrawer']>
  onlyErrorToast: (code: number, msg: string) => void
  check: (key: string) => boolean
  updateProfile: (params: any, opts?: Record<string, any>) => Promise<void>
  saveLocalTrack: (name: string | undefined) => void
}) {
  const { data, workspaceName, drawerInstance, onlyErrorToast, check, updateProfile, saveLocalTrack } = options

  function getAccountModel() {
    const row = unref(data)
    const ws = unref(workspaceName)

    return [
      {
        name: 'editPlatformAccount',
        label: $t('编辑账号'),
        icon: 'base/rx_ic_edit',
        visible: check('Profiles_edit_platform_outside') && row.windowPlatformList.length > 0,
        command: async () => {
          await drawerInstance.showDrawer({
            title: $t('为[{workspaceName}-{uid}]编辑平台账号', { workspaceName: ws, uid: row.windowSortNum }),
            dismissable: false,
            slots: {
              container: () => h(AccountEdit, {
                datas: row.windowPlatformList,
                onConfirm: async ({ platformUrlIds, windowPlatformList }: any) => {
                  const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
                    type: ProfileModifyType.PlatformEdit,
                    requestType: ProfileReqType.EditPlatform,
                    ids: [row.id],
                    paramList: {
                      platformUrlIds,
                      windowPlatformList,
                    },
                  })
                  drawerInstance.hideDrawer()
                  onlyErrorToast(code, msg)
                  if (code === 0) {
                    silentUpdateAccount(row, windowPlatformList)
                  }
                },
              }),
            },
          })
        },
      },
      {
        separator: true,
        visible: check('Profiles_add_platform_outside') && row.windowPlatformList.length > 0,
      },
      {
        name: 'addPlatformAccount',
        label: $t('添加账号'),
        icon: 'base/rx_ic_plus',
        visible: check('Profiles_add_platform_outside'),
        command: async () => {
          await drawerInstance.showDrawer({
            title: $t('为[{workspaceName}-{uid}]添加平台账号', { workspaceName: ws, uid: row.windowSortNum }),
            dismissable: false,
            slots: {
              container: () => h(AccountCreate, {
                showRemark: false,
                showCreateMore: false,
                onClose: () => {
                  drawerInstance.hideDrawer()
                },
                onConfirm: async (formData: any) => {
                  const { id, dirId, windowPlatformList } = row
                  const _windowPlatformList = windowPlatformList.concat({
                    ...formData,
                    _tempId: Date.now().toString(32),
                  })
                  await updateProfile({ id, dirId, windowPlatformList: _windowPlatformList, requestType: ProfileReqType.AddPlatform }, {
                    success: () => {
                      silentUpdateAccount(row, _windowPlatformList)
                    },
                  })
                },
              }),
            },
          })
        },
      },
      {
        name: 'choosePlatformAccount',
        label: $t('选择账号'),
        icon: 'base/rx_ic_exchange',
        visible: check('Profiles_select_platform'),
        command: async () => {
          await drawerInstance.showDrawer({
            title: $t('为[{workspaceName}-{uid}]选择平台账号', { workspaceName: ws, uid: row.windowSortNum }),
            dismissable: false,
            slots: {
              container: () => h(AccountList, {
                data: row,
                onConfirm: async (dataList: any[]) => {
                  drawerInstance.hideDrawer()
                  const { id, dirId, windowPlatformList } = row
                  const platformUrlIds = dataList.filter(item => item.id).map(item => item.id)
                  await updateProfile({ id, dirId, platformUrlIds, requestType: ProfileReqType.SelectPlatform }, {
                    success: () => {
                      const _windowPlatformList = windowPlatformList.filter((item: any) => !item.id).concat(dataList)
                      silentUpdateAccount(row, _windowPlatformList)
                    },
                  })
                },
              }),
            },
          })
        },
      },
    ].map((item: any) => {
      if (typeof item.command === 'function') {
        const original = item.command

        item.command = async () => {
          saveLocalTrack(item.name)
          return await original()
        }
      }

      return item
    })
  }

  return { getAccountModel }
}
