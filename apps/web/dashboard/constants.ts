export const fingerprintInfoList = [
  {
    label: 'OS/Kernal',
    width: '15rem',
    format: (winInfo) => {
      return `${winInfo.os || '--'} / ${winInfo.coreVersion || '--'}`
    },
  },
  {
    label: 'Browser Language',
    width: '15rem',
    format: (winInfo) => {
      return winInfo.language || '--'
    },
  },
  {
    label: 'User Agent',
    format: (winInfo) => {
      return winInfo.userAgent || '--'
    },
  },
]
