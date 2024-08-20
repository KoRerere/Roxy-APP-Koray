/** 默认的浏览器启动参数 */
export const defaultCLIArgs = [
  `--disable-background-mode`,
  '--disable-popup-blocking',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=0`,
  `--use-mock-keychain`,
]

/** 需要同步的本地数据 */
export const needSyncLocalFileMap = [
  {
    // IndexedDB同步
    path: `/Default/IndexedDB`,
    type: 'dir',
    key: 'syncIndexedDb',
  },
  {
    // Local Storage同步
    path: `/Default/Local Storage`,
    type: 'dir',
    key: 'syncLocalStorage',
  },
  {
    // 书签同步
    path: `/Default/Bookmarks`,
    type: 'file',
    key: 'syncBookmark',
  },
  {
    // 历史记录同步
    path: `/Default/History`,
    type: 'file',
    key: 'syncHistory',
  },
  // 扩展应用数据同步
  {
    path: `/Default/Local Extension Settings`,
    type: 'dir',
    key: 'syncExtensions',
  },
  {
    path: `/Default/databases`,
    type: 'dir',
    key: 'syncExtensions',
  },
  {
    path: `/Default/Managed Extension Settings`,
    type: 'dir',
    key: 'syncExtensions',
  },
  {
    path: `/Default/Sync Extension Settings`,
    type: 'dir',
    key: 'syncExtensions',
  },
  // {
  //   // 同步密码
  //   url: `/Default/Login Data`,
  //   type: "file"
  // }
] as const
