export interface ClipboardFileItemLike {
  kind: string
  getAsFile: () => File | null
}

export interface ClipboardDataLike {
  files?: ArrayLike<File> | null
  items?: ArrayLike<ClipboardFileItemLike> | null
}

export function getClipboardFiles(clipboardData: ClipboardDataLike | null) {
  if (!clipboardData)
    return []

  // `files` and file-kind `items` are two views of the same clipboard data.
  // Prefer one source and only use the other as a fallback so generated
  // clipboard files are not materialized twice with different metadata.
  const files = Array.from(clipboardData.files ?? [])
  if (files.length)
    return files

  return Array.from(clipboardData.items ?? []).flatMap((item) => {
    if (item.kind !== 'file')
      return []

    const file = item.getAsFile()
    return file ? [file] : []
  })
}
