export interface ProfileLeaseOwner {
  executionId: string
  conversationId?: string
  runId?: string
  taskId?: string
  sourceType?: 'chat' | 'task' | 'im' | 'sandbox'
  title?: string
}

interface ProfileLease {
  owner: ProfileLeaseOwner
  acquiredAt: number
  lastUsedAt: number
}

export class ProfileLeaseRegistry {
  private readonly leases = new Map<string, ProfileLease>()
  private readonly ownerProfiles = new Map<string, Set<string>>()
  private readonly operationTails = new Map<string, Promise<void>>()

  acquire(owner: ProfileLeaseOwner, dirIds: readonly string[]): void {
    const unique = [...new Set(dirIds.map(value => value.trim()).filter(Boolean))].sort()
    for (const dirId of unique) {
      const lease = this.leases.get(dirId)
      if (lease && lease.owner.executionId !== owner.executionId) {
        throw new Error(`浏览器 ${dirId} 正在被其他会话操作，请等待该会话结束后再试。`)
      }
    }

    const now = Date.now()
    let owned = this.ownerProfiles.get(owner.executionId)
    if (!owned) {
      owned = new Set<string>()
      this.ownerProfiles.set(owner.executionId, owned)
    }
    for (const dirId of unique) {
      const existing = this.leases.get(dirId)
      this.leases.set(dirId, {
        owner: { ...existing?.owner, ...owner },
        acquiredAt: existing?.acquiredAt ?? now,
        lastUsedAt: now,
      })
      owned.add(dirId)
    }
  }

  release(executionId: string): string[] {
    const owned = [...(this.ownerProfiles.get(executionId) ?? [])]
    for (const dirId of owned) {
      if (this.leases.get(dirId)?.owner.executionId === executionId) {
        this.leases.delete(dirId)
      }
    }
    this.ownerProfiles.delete(executionId)
    return owned
  }

  releaseProfile(dirId: string): void {
    const executionId = this.leases.get(dirId)?.owner.executionId
    this.leases.delete(dirId)
    if (!executionId) return
    const owned = this.ownerProfiles.get(executionId)
    owned?.delete(dirId)
    if (owned?.size === 0) this.ownerProfiles.delete(executionId)
  }

  getOwner(dirId: string): ProfileLeaseOwner | undefined {
    const owner = this.leases.get(dirId)?.owner
    return owner ? { ...owner } : undefined
  }

  getOwnedProfiles(executionId: string): string[] {
    return [...(this.ownerProfiles.get(executionId) ?? [])]
  }

  isOwnedBy(dirId: string, executionId: string): boolean {
    return this.leases.get(dirId)?.owner.executionId === executionId
  }

  async acquireOperation(dirId: string): Promise<() => void> {
    const previous = this.operationTails.get(dirId) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => release = resolve)
    this.operationTails.set(dirId, current)
    await previous
    return () => {
      release()
      if (this.operationTails.get(dirId) === current) this.operationTails.delete(dirId)
    }
  }

  clear(): void {
    this.leases.clear()
    this.ownerProfiles.clear()
    this.operationTails.clear()
  }
}

export const profileLeaseRegistry = new ProfileLeaseRegistry()
