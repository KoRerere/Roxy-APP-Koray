export interface ClipboardFileSystemEntryLike {
  isDirectory: boolean
  isFile: boolean
  name: string
}

export interface ClipboardFileItemLike {
  kind: string
  getAsFile: () => File | null
  webkitGetAsEntry?: () => ClipboardFileSystemEntryLike | null
}

export interface ClipboardDataLike {
  files?: ArrayLike<File> | null
  items?: ArrayLike<ClipboardFileItemLike> | null
}

export interface ClipboardFilePathSplit {
  localPathFiles: Array<{ file: File, path: string }>
  uploadFiles: File[]
}

export interface ClipboardFileSource {
  file: File
  entry: ClipboardFileSystemEntryLike | null
}

export interface ClipboardPathAttachment {
  kind: 'file' | 'folder'
  name: string
  path: string
}

function getPathBaseName(value: string) {
  return value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value
}

export function getClipboardFileSources(clipboardData: ClipboardDataLike | null): ClipboardFileSource[] {
  if (!clipboardData)
    return []

  const fileItems = Array.from(clipboardData.items ?? []).filter(item => item.kind === 'file')
  const files = Array.from(clipboardData.files ?? [])
  if (files.length) {
    return files.map((file, index) => ({
      file,
      entry: fileItems[index]?.webkitGetAsEntry?.() ?? null,
    }))
  }

  return fileItems.flatMap((item) => {
    const file = item.getAsFile()
    return file
      ? [{ file, entry: item.webkitGetAsEntry?.() ?? null }]
      : []
  })
}

export function getClipboardFiles(clipboardData: ClipboardDataLike | null) {
  return getClipboardFileSources(clipboardData).map(source => source.file)
}

export function splitClipboardFilesByLocalPath(
  files: File[],
  getLocalPath: (file: File) => string,
): ClipboardFilePathSplit {
  const localPathFiles: Array<{ file: File, path: string }> = []
  const uploadFiles: File[] = []

  for (const file of files) {
    const path = getLocalPath(file)
    if (path) {
      localPathFiles.push({ file, path })
    }
    else {
      uploadFiles.push(file)
    }
  }

  return { localPathFiles, uploadFiles }
}

export function createClipboardPathAttachment(
  fileName: string,
  path: string,
  entry: ClipboardFileSystemEntryLike | null,
): ClipboardPathAttachment {
  return {
    kind: entry?.isDirectory ? 'folder' : 'file',
    name: entry?.name || fileName || getPathBaseName(path),
    path,
  }
}
