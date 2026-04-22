import fs from 'node:fs'
import path from 'node:path'
import { env } from '../../config.js'

interface ThreadMapping {
  [channelId: string]: string
}

interface ThreadStore {
  [imName: string]: ThreadMapping
}

export class ThreadManager {
  private static instance: ThreadManager | null = null
  private store: ThreadStore = {}
  private readonly storePath: string

  private constructor() {
    this.storePath = path.join(env.DOWNLOADS_DIR, 'im-threads.json')
    this.load()
  }

  static getInstance(): ThreadManager {
    if (!ThreadManager.instance) {
      ThreadManager.instance = new ThreadManager()
    }
    return ThreadManager.instance
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf-8')
        this.store = JSON.parse(content)
        console.log(`[ThreadManager] Loaded thread mappings from ${this.storePath}`)
      }
    }
    catch (err) {
      console.warn('[ThreadManager] Failed to load thread mappings, starting fresh:', err)
      this.store = {}
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8')
    }
    catch (err) {
      console.error('[ThreadManager] Failed to save thread mappings:', err)
    }
  }

  getThreadId(imName: string, channelId: string): string {
    if (!this.store[imName]) {
      this.store[imName] = {}
    }
    if (!this.store[imName][channelId]) {
      this.store[imName][channelId] = this.generateThreadId()
      this.save()
    }
    return this.store[imName][channelId]
  }

  regenerateThreadId(imName: string, channelId: string): string {
    if (!this.store[imName]) {
      this.store[imName] = {}
    }
    const newThreadId = this.generateThreadId()
    this.store[imName][channelId] = newThreadId
    this.save()
    console.log(`[ThreadManager] Regenerated threadId for ${imName}/${channelId}: ${newThreadId}`)
    return newThreadId
  }

  clearThreadId(imName: string, channelId: string): void {
    if (this.store[imName]?.[channelId]) {
      delete this.store[imName][channelId]
      this.save()
      console.log(`[ThreadManager] Cleared threadId for ${imName}/${channelId}`)
    }
  }

  private generateThreadId(): string {
    return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
}
