import type { ResolvedTaskWindow } from './types'
import type { UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { API } from '@/api'
import { getOccupiedSandboxDirIds } from '@/services/sandboxService'

type BrowserRow = UserGetWindowInfoV2ListData['data']['rows'][number]

export class WindowReservationRegistry {
  private readonly ownersByDirId = new Map<string, string>()
  private readonly dirIdsByOwner = new Map<string, Set<string>>()

  reserveAvailable(ownerId: string, dirIds: string[]): string[] {
    const reserved: string[] = []
    let ownerDirIds = this.dirIdsByOwner.get(ownerId)
    if (!ownerDirIds) {
      ownerDirIds = new Set<string>()
      this.dirIdsByOwner.set(ownerId, ownerDirIds)
    }

    for (const dirId of dirIds) {
      const currentOwner = this.ownersByDirId.get(dirId)
      if (currentOwner && currentOwner !== ownerId) {
        continue
      }
      this.ownersByDirId.set(dirId, ownerId)
      ownerDirIds.add(dirId)
      reserved.push(dirId)
    }

    if (ownerDirIds.size === 0) {
      this.dirIdsByOwner.delete(ownerId)
    }
    return reserved
  }

  release(ownerId: string): void {
    const dirIds = this.dirIdsByOwner.get(ownerId)
    if (!dirIds) {
      return
    }
    for (const dirId of dirIds) {
      if (this.ownersByDirId.get(dirId) === ownerId) {
        this.ownersByDirId.delete(dirId)
      }
    }
    this.dirIdsByOwner.delete(ownerId)
  }

  isReserved(dirId: string): boolean {
    return this.ownersByDirId.has(dirId)
  }
}

export interface TaskWindowResolverDeps {
  listWindows: (dirIds: string[]) => Promise<BrowserRow[]>
  getWindowStatuses: (ids: number[]) => Promise<Array<{
    id: number
    dirId: string
    openStatus: number
    statusInfo: unknown[]
  }>>
  getOccupiedDirIds: () => string[]
  reservations: WindowReservationRegistry
}

const defaultDeps: TaskWindowResolverDeps = {
  async listWindows(dirIds) {
    const response = await API.window.userGetWindowInfoV2List({
      page_index: 1,
      page_size: Math.max(dirIds.length, 1),
      dirIds: dirIds.join(','),
      isDelete: 0,
    } as any)
    if (response.code !== 0) {
      throw new Error(response.msg || 'Failed to resolve task windows')
    }

    return response.data?.rows ?? []
  },
  async getWindowStatuses(ids) {
    const response = await API.window.userGetWindowStatusInfoCreate({ ids })
    if (response.code !== 0) {
      throw new Error(response.msg || 'Failed to read task window status')
    }

    return response.data ?? []
  },
  getOccupiedDirIds: getOccupiedSandboxDirIds,
  reservations: new WindowReservationRegistry(),
}

function uniqueInOrder(values: string[]): string[] {
  return Array.from(new Set(values))
}

export async function reserveAvailableTaskWindows(
  windowIds: string[],
  ownerId: string,
  deps: TaskWindowResolverDeps = defaultDeps,
): Promise<ResolvedTaskWindow[]> {
  const requestedDirIds = uniqueInOrder(windowIds)
  if (requestedDirIds.length === 0) {
    return []
  }

  const rows = await deps.listWindows(requestedDirIds)
  const rowsByDirId = new Map(
    rows
      .filter((row): row is BrowserRow & { id: number, dirId: string } =>
        typeof row.id === 'number' && typeof row.dirId === 'string' && row.dirId.length > 0)
      .map(row => [row.dirId, row]),
  )
  const orderedRows = requestedDirIds.flatMap((dirId) => {
    const row = rowsByDirId.get(dirId)
    return row ? [row] : []
  })
  if (orderedRows.length === 0) {
    return []
  }

  const statuses = await deps.getWindowStatuses(orderedRows.map(row => row.id))
  const statusById = new Map(statuses.map(status => [status.id, status]))
  const occupied = new Set(deps.getOccupiedDirIds())
  const remotelyAvailable = orderedRows.filter((row) => {
    const status = statusById.get(row.id)
    return Boolean(
      status
      && status.openStatus !== 1
      && Array.isArray(status.statusInfo)
      && status.statusInfo.length === 0
      && !occupied.has(row.dirId),
    )
  })

  const reserved = new Set(
    deps.reservations.reserveAvailable(ownerId, remotelyAvailable.map(row => row.dirId)),
  )
  return remotelyAvailable
    .filter(row => reserved.has(row.dirId))
    .map(row => ({
      id: row.id,
      dirId: row.dirId,
      windowName: row.windowName,
      windowSortNum: row.windowSortNum,
    }))
}

export const windowReservationRegistry = defaultDeps.reservations
