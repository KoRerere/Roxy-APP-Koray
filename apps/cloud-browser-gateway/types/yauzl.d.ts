declare module 'yauzl' {
  import type { EventEmitter } from 'node:events'
  import type { Readable } from 'node:stream'

  export interface Entry {
    fileName: string
    compressedSize: number
    uncompressedSize: number
    generalPurposeBitFlag: number
    compressionMethod: number
    isEncrypted(): boolean
    isCompressed(): boolean
  }

  export interface OpenOptions {
    lazyEntries?: boolean
    strictFileNames?: boolean
    decodeStrings?: boolean
    validateEntrySizes?: boolean
  }

  export interface ZipFile extends EventEmitter {
    readEntry(): void
    close(): void
    openReadStream(
      entry: Entry,
      callback: (err: Error | null, readStream?: Readable) => void,
    ): void
  }

  export function open(
    path: string,
    options: OpenOptions,
    callback: (err: Error | null, zipfile?: ZipFile) => void,
  ): void

  export function fromBuffer(
    buffer: Buffer,
    options: OpenOptions,
    callback: (err: Error | null, zipfile?: ZipFile) => void,
  ): void
}
