import type { DashboardEntityLabels } from '/@/composables/useDashboardEntityLabels'
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { createDashboardEntityLabels } from '/@/composables/useDashboardEntityLabels'

type WinInfo = UnwrapRowType<UserGetWindowInfoV2ListData>

// export const baseUrl = `http://${location.hostname}:${globalThis.serverPort || new URLSearchParams(window.location.search).get('port')}`

export const fingerprintInfoList = [
  {
    label: () => $t('系统/内核'),
    width: '15rem',
    format: (winInfo: WinInfo) => {
      const { os, coreVersion, coreType } = winInfo
      return `${(os === 'IOS' ? 'iOS' : os) || '--'} / Roxy${coreType} ${coreVersion || '--'}`
    },
  },
  {
    label: () => $t('语言'),
    width: '15rem',
    format: (winInfo: WinInfo) => {
      return winInfo.isLanguageBaseIp ? '--' : (winInfo.language || '--')
    },
  },
  {
    label: () => 'User Agent',
    format: (winInfo: WinInfo) => {
      return winInfo.userAgent || '--'
    },
  },
]

/** 按工作台文案生成窗口/账号信息列表（项目↔分组） */
export function createProfileInfoList(labels: DashboardEntityLabels = createDashboardEntityLabels(false)) {
  return [
    {
      label: () => $t('备注'),
      width: '15rem',
      customRender: (winInfo: WinInfo) => {
        return <>{winInfo.windowRemark || '--'}</>
      },
    },
    {
      label: () => labels.projectLabel,
      width: '15rem',
      customRender: (winInfo: WinInfo) => {
        return <>{winInfo.projectName || '--'}</>
      },
    },
    {
      label: () => $t('标签'),
      customRender: (winInfo: WinInfo) => {
        const { labelInfo } = winInfo
        return (
          <div class="tag-wrap">
            {
              labelInfo?.length
                ? labelInfo.map(item => (
                    <div class="tag">
                      <span class="dot" style={{ '--tag-color': item.labelColor }}></span>
                      <span>{item.labelName}</span>
                    </div>
                  ),
                  )
                : '--'
            }
          </div>
        )
      },
    },
  ]
}

/** 默认普通模式文案；电商请用 createProfileInfoList(labels) */
export const profileInfoList = createProfileInfoList()