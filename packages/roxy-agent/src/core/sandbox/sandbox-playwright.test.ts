import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { beforeEach, it, vi } from 'vitest'

const chromiumConnect = vi.fn()
const firefoxConnect = vi.fn()
const chromium = {
  connect: chromiumConnect,
  name: () => 'chromium',
}
const firefox = {
  connect: firefoxConnect,
  name: () => 'firefox',
}

vi.mock('@roxybrowser/playwright', () => ({ chromium, firefox }))

class FakeBrowser extends EventEmitter {
  close = vi.fn(async () => this.emit('disconnected', this))
}

beforeEach(() => {
  chromiumConnect.mockReset()
  firefoxConnect.mockReset()
})

it('forces per-run Chromium asset roots and closes only owned browsers', async () => {
  const browser = new FakeBrowser()
  chromiumConnect.mockResolvedValue(browser)
  const { createSandboxPlaywrightFacade } = await import('./sandbox-playwright')
  const facade = createSandboxPlaywrightFacade({
    browserUrl: 'ws://127.0.0.1/browser/run',
    browserOutputDir: '/tmp/run/browser',
    isActive: () => true,
  })
  const connected = await facade.chromium.connect('ws://127.0.0.1/browser/run', { screenshotsDir: '/tmp/escape' })
  assert.equal(connected, browser)
  assert.equal(chromiumConnect.mock.calls[0]?.[1].screenshotsDir, '/tmp/run/browser')
  assert.equal(chromiumConnect.mock.calls[0]?.[1].downloadsDir, '/tmp/run/browser')
  await facade.dispose()
  assert.equal(browser.close.mock.calls.length, 1)
})

it('connects Firefox through the per-run facade and closes only owned browsers', async () => {
  const browser = new FakeBrowser()
  firefoxConnect.mockResolvedValue(browser)
  const { createSandboxPlaywrightFacade } = await import('./sandbox-playwright')
  const facade = createSandboxPlaywrightFacade({
    browserUrl: 'ws://127.0.0.1/firefox/run',
    browserOutputDir: '/tmp/run/browser',
    isActive: () => true,
  })
  const connected = await facade.firefox.connect('ws://127.0.0.1/firefox/run', { screenshotsDir: '/tmp/escape' })
  assert.equal(connected, browser)
  assert.equal(firefoxConnect.mock.calls[0]?.[1].screenshotsDir, '/tmp/run/browser')
  assert.equal(firefoxConnect.mock.calls[0]?.[1].downloadsDir, '/tmp/run/browser')
  await facade.dispose()
  assert.equal(browser.close.mock.calls.length, 1)
})

it('rejects foreign endpoints for browser connections', async () => {
  const { createSandboxPlaywrightFacade } = await import('./sandbox-playwright')
  const facade = createSandboxPlaywrightFacade({
    browserUrl: 'ws://127.0.0.1/browser/run',
    browserOutputDir: '/tmp/run/browser',
    isActive: () => true,
  })
  await assert.rejects(() => facade.chromium.connect('ws://127.0.0.1/browser/other'), /assigned to this run/)
  await assert.rejects(() => facade.firefox.connect('ws://127.0.0.1/firefox/other'), /assigned to this run/)
})
