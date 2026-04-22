declare module 'yazl' {
  import type { Readable } from 'node:stream'
  import type { PassThrough } from 'node:stream'

  export interface AddEntryOptions {
    mtime?: Date
    mode?: number
    compress?: boolean
    compressionLevel?: number
    forceDosTimestamp?: boolean
  }

  export interface EndOptions {
    comment?: string | Buffer
    forceZip64Format?: boolean
  }

  export class ZipFile {
    outputStream: PassThrough
    addFile(realPath: string, metadataPath: string, options?: AddEntryOptions): void
    addReadStream(readStream: Readable, metadataPath: string, options?: AddEntryOptions): void
    addBuffer(buffer: Buffer, metadataPath: string, options?: AddEntryOptions): void
    addEmptyDirectory(metadataPath: string, options?: AddEntryOptions): void
    end(options?: EndOptions, calculatedTotalSizeCallback?: (totalSize: number) => void): void
    on(event: 'error', listener: (err: Error) => void): this
  }
}
