declare module 'qrcode' {
  export interface QRCodeColorOptions {
    dark?: string
    light?: string
  }

  export interface QRCodeToFileOptions {
    width?: number
    margin?: number
    color?: QRCodeColorOptions
  }

  export function toFile(
    path: string,
    text: string,
    options?: QRCodeToFileOptions,
  ): Promise<void>

  const QRCode: {
    toFile: typeof toFile
  }

  export default QRCode
}
