import axios from "axios";
import { getAllSyncControlBrowsers, getRoxySyncAPIBaseURL, setMainControlColor } from "/@/modules/sync-control/bin";
import { SyncControlDoLayoutPayload, SyncControlSendTextPayload, SyncControlSettings } from "/@/modules/sync-control/model";
import { setTimeout } from "timers/promises";
import { getSynchronizerActionBarWindow } from "/@/modules/sync-control/actionBar";
import { getMainWindow } from "/@/modules/app/mainWindow";

const instance = axios.create();

instance.interceptors.response.use((response) => {
  return response.data;
})

/**
 * 2. 窗口排列：
  GET /api/arrange
  参数1： monitor_index 显示器索引
  参数2: type
  type=grid 表示平铺
  type=stack 表示堆叠
  type=custom 表示自定义，自定义的时候还需要如下参数：
  w: 窗口宽度
  h: 窗口高度
  gap_horizontal: 水平间隔
  gap_vertical: 垂直间隔
  count_per_row: 每一行的窗口个数

  返回：
  {
      "code": 0,
      "msg": "success"
  }
  code为0表示成功，其他表示失败
 * */
export function windowArrange(params: SyncControlDoLayoutPayload) {
  const baseUrl = getRoxySyncAPIBaseURL()
  console.log('窗口排列 params:', params)
  return instance.get(`${baseUrl}/api/arrange`, { params })
}

/**
 * 3.发送文本
  POST /api/send_text
  body参数格式
  {
    "mode":xx(string),
    "data":xxx(string)
  }

  当mode为same的时候，表示所有窗口使用相同文本，data为文本内容
  当mode为diff的时候，表示每个窗口使用不同的内容，data为每个窗口的内容,用dict表示,可以为pid,value为文本内容，例如：
  {
    "10000":"aaaa",
    "10002":"bbbb"
  }

  当mode为random的时候,表示随机生成，data为随机策略，格式为dict,
  {
    // 随机范围 -- 注意传入的是string类型
    "min":"111",
    "max":"2222",
  }
 */
export function sendText(params: SyncControlSendTextPayload) {
  const baseUrl = getRoxySyncAPIBaseURL()
  return instance.post(`${baseUrl}/api/send_text`, params)
}

/** 显示所有窗口 */
export async function showAllWindows() {
  const baseUrl = getRoxySyncAPIBaseURL()
  return instance.get(`${baseUrl}/api/show_window`)
  // const actionBar = getMainWindow()
  // for (const browser of getAllSyncControlBrowsers()) {
  //   await browser.launch()
  // }
}

/**
 * 5. 设置
  POST /api/sync_settings
  参数： settings结构
 */
export function syncSettings(settings: SyncControlSettings) {
  const baseUrl = getRoxySyncAPIBaseURL()
  setMainControlColor(settings.mainControlWindowColor)
  const { enableClickDelay, enableInputDelay } = settings

  // 是否启用了点击延迟
  if (!enableClickDelay) {
    settings.clickIntervalMinMs = 0
    settings.clickIntervalMaxMs = 0
  }


  // 是否启用了输入延迟
  if (!enableInputDelay) {
    settings.inputIntervalMinMs = 0
    settings.inputIntervalMaxMs = 0
  }

  console.log('syncSettings settings:', settings)

  return instance.post(`${baseUrl}/api/sync_settings`, settings)
}

/* 开始同步 */
export function startSyncControl() {
  const baseUrl = getRoxySyncAPIBaseURL()
  return instance.get(`${baseUrl}/api/start_sync`)
}
/* 暂停同步 */
export function stopSyncControl() {
  const baseUrl = getRoxySyncAPIBaseURL()
  return instance.get(`${baseUrl}/api/stop_sync`)
}
