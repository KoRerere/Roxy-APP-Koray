/**
 * 浏览器事件类型定义
 */

import type { ChromeTarget } from './target'

/**
 * 进程退出事件数据
 */
export interface ProcessExitData {
    code: number | null
    signal: NodeJS.Signals | null
}

/**
 * 浏览器事件映射
 */
export interface BrowserEvents {
    // 目标相关事件
    targetcreated: (target: ChromeTarget) => void
    targetdestroyed: (target: ChromeTarget) => void
    targetchanged: (target: ChromeTarget) => void

    // 连接相关事件
    disconnected: () => void

    // 进程相关事件
    'process-exit': (data: ProcessExitData) => void
    'process-close': (data: ProcessExitData) => void
    'process-error': (error: Error) => void
}

/**
 * 类型安全的事件监听器接口
 */
export interface TypedEventEmitter<T extends Record<string, (...args: any[]) => void>> {
    on<K extends keyof T>(event: K, listener: T[K]): this
    off<K extends keyof T>(event: K, listener: T[K]): this
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean
}
