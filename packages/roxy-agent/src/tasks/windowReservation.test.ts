import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  reserveAvailableTaskWindows,
  WindowReservationRegistry,
} from './windowReservation'

function windowRow(id: number, dirId: string) {
  return { id, dirId, windowName: `Window ${id}`, windowSortNum: id }
}

describe('task window reservation', () => {
  it('preserves task order and excludes remote, sandbox, and local conflicts', async () => {
    const reservations = new WindowReservationRegistry()
    reservations.reserveAvailable('other-task', ['window-b'])
    const resolved = await reserveAvailableTaskWindows(
      ['window-c', 'window-a', 'window-b'],
      'task-log',
      {
        listWindows: async () => [
          windowRow(1, 'window-a'),
          windowRow(2, 'window-b'),
          windowRow(3, 'window-c'),
        ] as any,
        getWindowStatuses: async () => [
          { id: 1, dirId: 'window-a', openStatus: 0, statusInfo: [] },
          { id: 2, dirId: 'window-b', openStatus: 0, statusInfo: [] },
          { id: 3, dirId: 'window-c', openStatus: 1, statusInfo: [] },
        ],
        getOccupiedDirIds: () => [],
        reservations,
      },
    )

    assert.deepEqual(resolved.map(window => window.dirId), ['window-a'])
    assert.equal(reservations.isReserved('window-a'), true)
    reservations.release('task-log')
    assert.equal(reservations.isReserved('window-a'), false)
  })

  it('does not call browser APIs for windowless tasks', async () => {
    let called = false
    const resolved = await reserveAvailableTaskWindows([], 'task-log', {
      listWindows: async () => {
        called = true
        return []
      },
      getWindowStatuses: async () => {
        called = true
        return []
      },
      getOccupiedDirIds: () => [],
      reservations: new WindowReservationRegistry(),
    })
    assert.deepEqual(resolved, [])
    assert.equal(called, false)
  })
})
