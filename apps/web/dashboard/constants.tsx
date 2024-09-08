import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import tagBlueSvg from '/@/assets/image/tags/tag-blue.svg'
import tagRedSvg from '/@/assets/image/tags/tag-red.svg'

type WinInfo = UnwrapRowType<UserGetWindowInfoV2ListData>

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
    label: 'Group',
    width: '15rem',
    customRender: (winInfo: WinInfo) => {
      return <>{winInfo.groupName || '--'}</>
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
