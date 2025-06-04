import { ChromeCDPSession } from './cdp-session'
import type { ChromeBrowser } from './browser'
import type { Client } from 'chrome-remote-interface'
import type { Protocol } from 'puppeteer-core'

/**
 * Target 封装
 */
export class ChromeTarget {
    private client: Client
    private targetInfo: Protocol.Target.TargetInfo
    private browserInstance: ChromeBrowser

    constructor(client: Client, targetInfo: Protocol.Target.TargetInfo, browser: ChromeBrowser) {
        this.client = client
        this.targetInfo = targetInfo
        this.browserInstance = browser
    }

    updateInfo(targetInfo: Protocol.Target.TargetInfo) {
        this.targetInfo = targetInfo
    }

    url(): string {
        return this.targetInfo.url || ''
    }

    type(): string {
        return this.targetInfo.type || 'other'
    }

    get _targetId(): string {
        return this.targetInfo.targetId
    }

    async createCDPSession(): Promise<ChromeCDPSession> {
        // 如果是浏览器目标，不能创建 CDP Session
        if (this.targetInfo.targetId === 'browser') {
            throw new Error('Cannot create CDP session for browser target. Use a page target instead.');
        }

        const { sessionId } = await this.client.Target.attachToTarget({
            targetId: this.targetInfo.targetId,
            flatten: true
        })
        return new ChromeCDPSession(this.client, sessionId, this.targetInfo.targetId)
    }
}
