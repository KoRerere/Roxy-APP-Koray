import assert from 'node:assert/strict'
import test from 'node:test'
import { openOrDownloadLocalPath } from './localFileAction'

function createDependencies(type: 'directory' | 'file' | 'other') {
  const calls = {
    copiedPaths: [] as Array<[string, string]>,
    openedPaths: [] as string[],
    saveDialogDefaults: [] as string[],
  }

  return {
    calls,
    dependencies: {
      async copyFile(sourcePath: string, targetPath: string) {
        calls.copiedPaths.push([sourcePath, targetPath])
      },
      async openPath(targetPath: string) {
        calls.openedPaths.push(targetPath)
        return ''
      },
      async showSaveDialog(defaultPath: string) {
        calls.saveDialogDefaults.push(defaultPath)
        return { canceled: false, filePath: '/Users/admin/Downloads/report.md' }
      },
      async stat() {
        return {
          isDirectory: () => type === 'directory',
          isFile: () => type === 'file',
        }
      },
    },
  }
}

test('opens a local directory without showing the save dialog', async () => {
  const { calls, dependencies } = createDependencies('directory')

  const result = await openOrDownloadLocalPath(
    { sourcePath: '/Users/admin/output' },
    dependencies,
  )

  assert.deepEqual(result, {
    action: 'opened-directory',
    canceled: false,
    filePath: '/Users/admin/output',
  })
  assert.deepEqual(calls.openedPaths, ['/Users/admin/output'])
  assert.deepEqual(calls.saveDialogDefaults, [])
  assert.deepEqual(calls.copiedPaths, [])
})

test('downloads a local file through the existing save dialog flow', async () => {
  const { calls, dependencies } = createDependencies('file')

  const result = await openOrDownloadLocalPath(
    { sourcePath: '/Users/admin/output/report.md', fileName: 'Agent report.md' },
    dependencies,
  )

  assert.deepEqual(result, {
    action: 'downloaded-file',
    canceled: false,
    filePath: '/Users/admin/Downloads/report.md',
  })
  assert.deepEqual(calls.openedPaths, [])
  assert.deepEqual(calls.saveDialogDefaults, ['Agent report.md'])
  assert.deepEqual(calls.copiedPaths, [[
    '/Users/admin/output/report.md',
    '/Users/admin/Downloads/report.md',
  ]])
})

test('does not copy a local file when the save dialog is canceled', async () => {
  const { calls, dependencies } = createDependencies('file')
  dependencies.showSaveDialog = async (defaultPath: string) => {
    calls.saveDialogDefaults.push(defaultPath)
    return { canceled: true }
  }

  const result = await openOrDownloadLocalPath(
    { sourcePath: '/Users/admin/output/report.md' },
    dependencies,
  )

  assert.deepEqual(result, {
    action: 'downloaded-file',
    canceled: true,
  })
  assert.deepEqual(calls.saveDialogDefaults, ['report.md'])
  assert.deepEqual(calls.copiedPaths, [])
})

test('surfaces the system error when opening a directory fails', async () => {
  const { dependencies } = createDependencies('directory')
  dependencies.openPath = async () => 'No application is associated with the specified file'

  await assert.rejects(
    openOrDownloadLocalPath({ sourcePath: '/Users/admin/output' }, dependencies),
    /Failed to open local directory: No application is associated with the specified file/,
  )
})

test('rejects a local path that is neither a file nor a directory', async () => {
  const { dependencies } = createDependencies('other')

  await assert.rejects(
    openOrDownloadLocalPath({ sourcePath: '/Users/admin/output/socket' }, dependencies),
    /Local path is not a file or directory/,
  )
})

test('preserves stat errors for missing local paths', async () => {
  const { dependencies } = createDependencies('file')
  const missingPathError = Object.assign(new Error('Missing local path'), { code: 'ENOENT' })
  dependencies.stat = async () => {
    throw missingPathError
  }

  await assert.rejects(
    openOrDownloadLocalPath({ sourcePath: '/Users/admin/output/missing.md' }, dependencies),
    error => error === missingPathError,
  )
})
