import CookieEdit from '/@/views/browser/list/profiles/components/cookie-edit.vue'
import CookieRobot from '/@/views/browser/list/profiles/components/cookie-robot.vue'
import { RxAlert } from '/@/components/rx-alert'
import { useDrawer } from '/@/hooks/useDrawer'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import type { ParsedCookie } from '/@/utils/cookie'

type ProfileData = UserGetWindowInfoListListData['data']['rows'][number]

interface Params {
  data: ProfileData[]
  onConfirm: (cookie: ParsedCookie[]) => Promise<void>
}

export function useCookie() {
  const { currentWorkspace } = storeToRefs(useWorkspaceStore())
  const { mixpanelTrack } = useUserStore()
  const { showDrawer, hideDrawer } = useDrawer()
  const [showModal] = useDialog()

  function editCookieByProfile(params: Params) {
    const { data, onConfirm } = params
    const names = data.slice(0, 3).map(item => `${currentWorkspace.value?.workspaceName}-${item.windowSortNum}`).join(', ')
    const namesStr = `[${names}${data.length > 3 ? '...' : ''}]`

    showDrawer({
      title: $t('为 {names} 编辑 Cookies', { names: namesStr }),
      dismissable: false,
      slots: {
        container: () => (
          <div class="h-full flex flex-col">
            {data.length > 1 && (
              <div class="px-4 pt-4">
                <RxAlert class="min-w-full" type="warn" closable={false} title={$t('所选窗口的所有 Cookie 都将被覆盖，请谨慎操作。')} />
              </div>
            )}
            <CookieEdit
              class="flex-1"
              data={data.length > 1 ? undefined : data[0]}
              onConfirm={async (cookie) => {
                await onConfirm(cookie)
                hideDrawer()
              }}
            >
            </CookieEdit>
          </div>
        ),
      },
    })
  }

  function startCookieRobot(data: ProfileData[]) {
    mixpanelTrack('click_enter_cookie_bot')
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => (
          <CookieRobot
            data={data}
            onConfirm={async (params) => {
              mixpanelTrack('click_run_cookie_bot')
              const dirIds = data.map(item => item.dirId!)
              globalThis.electronAPI.send('browser:startCookieRobot', { dirIds, ...params })
              hideModal()
            }}
            onClose={hideModal}
          >
          </CookieRobot>
        ),
      },
    })
  }

  return { editCookieByProfile, startCookieRobot }
}
