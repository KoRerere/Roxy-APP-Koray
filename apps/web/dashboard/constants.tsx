import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'

type WinInfo = UnwrapRowType<UserGetWindowInfoV2ListData>

export const baseUrl = `http://${location.hostname}:${globalThis.serverPort || new URLSearchParams(window.location.search).get('port')}`

export const fingerprintInfoList = [
  {
    label: 'OS/Kernal',
    width: '15rem',
    format: (winInfo: WinInfo) => {
      return `${winInfo.os || '--'} / ${winInfo.coreVersion || '--'}`
    },
  },
  {
    label: 'Browser Language',
    width: '15rem',
    format: (winInfo: WinInfo) => {
      return winInfo.language || '--'
    },
  },
  {
    label: 'User Agent',
    format: (winInfo: WinInfo) => {
      return winInfo.userAgent || '--'
    },
  },
]

export const profileInfoList = [
  {
    label: 'Notes',
    width: '15rem',
    customRender: (winInfo: WinInfo) => {
      return <>{winInfo.windowRemark || '--'}</>
    },
  },
  {
    label: 'Project',
    width: '15rem',
    customRender: (winInfo: WinInfo) => {
      return <>{winInfo.projectName || '--'}</>
    },
  },
  {
    label: 'Tags',
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
