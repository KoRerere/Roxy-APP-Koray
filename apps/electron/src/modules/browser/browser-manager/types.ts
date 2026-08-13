import type { UnwrapRowType, UserAddWindowInfoV2CreatePayload, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import type { VirtualWorkAreaUnion } from '/@/utils/windowGridLayout'

/** 启动期附加的窗口定位参数，仅在本次启动的 payload 中传递，不落库 */
export interface LaunchPositionOverrides {
  /**
   * windowRatioPosition 的比例基准矩形（DIP）。
   * 批量启动时由入口一次性快照，确保同一批窗口落在同一块屏幕。
   */
  windowPositionBase?: VirtualWorkAreaUnion
  /**
   * 窗口左上角绝对坐标 'x,y'（DIP）。
   * 由宫格铺屏、自定义布局等已算好跨屏坐标的流程下发，存在时忽略 windowRatioPosition。
   */
  windowAbsolutePosition?: string
}

export type WindowItemType = UnwrapRowType<UserGetWindowInfoV2ListData> & UserAddWindowInfoV2CreatePayload & LaunchPositionOverrides
