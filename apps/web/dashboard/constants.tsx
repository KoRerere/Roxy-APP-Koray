import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { $t } from '/@/locales'

type WinInfo = UnwrapRowType<UserGetWindowInfoV2ListData>

// export const baseUrl = `http://${location.hostname}:${globalThis.serverPort || new URLSearchParams(window.location.search).get('port')}`

export const fingerprintInfoList = [
  {
    label: () => $t('系统/内核'),
    width: '15rem',
    format: (winInfo: WinInfo) => {
      return `${winInfo.os || '--'} / ${winInfo.coreVersion || '--'}`
    },
  },
  {
    label: () => $t('语言'),
    width: '15rem',
    format: (winInfo: WinInfo) => {
      return winInfo.language || '--'
    },
  },
  {
    label: () => 'User Agent',
    format: (winInfo: WinInfo) => {
      return winInfo.userAgent || '--'
    },
  },
]

export const profileInfoList = [
  {
    label: () => $t('备注'),
    width: '15rem',
    customRender: (winInfo: WinInfo) => {
      return <>{winInfo.windowRemark || '--'}</>
    },
  },
  {
    label: () => $t('项目'),
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
