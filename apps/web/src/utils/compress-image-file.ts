/** KYC 等场景单图最长边上限，过高分辨率对审核无增益且占用内存 */
const MAX_DIMENSION = 4096

/** 缩放下限：避免过度压缩导致证件文字不可辨认 */
const MIN_DIMENSION = 800

const INITIAL_JPEG_QUALITY = 0.85
const MIN_JPEG_QUALITY = 0.5
const JPEG_QUALITY_STEP = 0.05
const DIMENSION_SCALE_FACTOR = 0.85

export type CompressImageErrorCode = 'failed' | 'too_large'

/** 图片压缩失败（解码/编码异常或仍超过体积上限） */
export class CompressImageError extends Error {
  readonly code: CompressImageErrorCode

  constructor(code: CompressImageErrorCode) {
    super(code)
    this.name = 'CompressImageError'
    this.code = code
  }
}

function toJpegFileName(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  const base = dot >= 0 ? fileName.slice(0, dot) : fileName
  return `${base}.jpg`
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob)
        resolve(blob)
      else
        reject(new Error('Canvas toBlob returned null'))
    }, 'image/jpeg', quality)
  })
}

/**
 * 将超过体积上限的图片压缩为 JPEG。
 * 身份证/营业执照为照片类内容，JPEG 体积更优；PNG 透明通道在此场景无意义。
 */
export async function compressImageFile(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes)
    return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  }
  catch (error) {
    console.warn('[compressImageFile] failed to decode image:', error)
    throw new CompressImageError('failed')
  }

  try {
    let width = bitmap.width
    let height = bitmap.height
    const maxSide = Math.max(width, height)
    if (maxSide > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / maxSide
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx)
      throw new CompressImageError('failed')

    while (Math.min(width, height) >= MIN_DIMENSION) {
      canvas.width = width
      canvas.height = height
      ctx.drawImage(bitmap, 0, 0, width, height)

      for (let quality = INITIAL_JPEG_QUALITY; quality >= MIN_JPEG_QUALITY; quality -= JPEG_QUALITY_STEP) {
        try {
          const blob = await canvasToJpegBlob(canvas, quality)
          if (blob.size <= maxBytes) {
            return new File([blob], toJpegFileName(file.name), { type: 'image/jpeg' })
          }
        }
        catch (error) {
          console.warn('[compressImageFile] failed to encode jpeg:', error)
          throw new CompressImageError('failed')
        }
      }

      width = Math.round(width * DIMENSION_SCALE_FACTOR)
      height = Math.round(height * DIMENSION_SCALE_FACTOR)
    }

    throw new CompressImageError('too_large')
  }
  finally {
    bitmap.close()
  }
}
