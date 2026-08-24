import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createRuntimeFileCollector } from './file-collector'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('runtime file collector', () => {
  it('deduplicates paths and clears files after consumption', () => {
    // Regression: the runtime chat path imported its artifact store from
    // Keep the replacement execution path independent from the legacy engine.
    // Fixed by: a runtime-owned collector with the same structural contract.
    const collector = createRuntimeFileCollector()
    collector.record({ virtualPath: 'report.csv', realPath: '/tmp/old.csv', op: 'write' })
    collector.record({ virtualPath: 'report.csv', realPath: '/tmp/report.csv', op: 'edit' })

    expect(collector.peek()).toEqual([
      { virtualPath: 'report.csv', realPath: '/tmp/report.csv', op: 'edit' },
    ])
    expect(collector.consume()).toHaveLength(1)
    expect(collector.peek()).toEqual([])
  })

  it('scans newly created browser and sandbox files once at consume time', async () => {
    // Regression: artifact-root scanning lived behind an empty plugin whose setup
    // hook did nothing, obscuring that the collector owned all behavior.
    // Fixed by: construct the collector directly and keep its scan contract here.
    const root = await mkdtemp(path.join(os.tmpdir(), 'roxy-artifacts-'))
    roots.push(root)
    const browserDir = path.join(root, 'browser', 'screenshots')
    const sandboxDir = path.join(root, 'workdir', 'script')
    await mkdir(browserDir, { recursive: true })
    await mkdir(sandboxDir, { recursive: true })
    const collector = createRuntimeFileCollector({
      artifactRoots: [path.join(root, 'browser'), path.join(root, 'workdir')],
      displayRoot: root,
    })
    await writeFile(path.join(browserDir, 'shot.png'), 'png')
    await writeFile(path.join(sandboxDir, 'data.json'), '{}')

    const files = collector.consume()
    expect(files.map(file => file.displayName).sort()).toEqual([
      'browser/screenshots/shot.png',
      'workdir/script/data.json',
    ])
    expect(collector.consume()).toEqual([])
  })

  it('baselines artifact roots that are registered after collector creation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'roxy-dynamic-artifacts-'))
    roots.push(root)
    await writeFile(path.join(root, 'existing.png'), 'old')
    const collector = createRuntimeFileCollector()

    collector.addArtifactRoot(root, 'profiles/dir-1')
    await writeFile(path.join(root, 'new.png'), 'new')

    expect(collector.consume()).toMatchObject([
      {
        displayName: 'profiles/dir-1/new.png',
        source: 'artifact_root_scan',
      },
    ])
  })
})
