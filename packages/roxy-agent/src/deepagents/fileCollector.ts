export interface CollectedFile {
  virtualPath: string
  realPath: string
  op: 'write' | 'edit'
  displayName?: string
}

export interface FileCollectorStore {
  record: (file: CollectedFile) => void
  consume: () => CollectedFile[]
  peek: () => CollectedFile[]
}

export function createFileCollectorStore(): FileCollectorStore {
  const files = new Map<string, CollectedFile>()

  return {
    record(file) {
      files.set(file.virtualPath, file)
    },
    consume() {
      const out = [...files.values()]
      files.clear()
      return out
    },
    peek() {
      return [...files.values()]
    },
  }
}
