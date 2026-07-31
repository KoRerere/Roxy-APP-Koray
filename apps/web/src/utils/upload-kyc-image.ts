import { tempUploadOssFile } from '/@/_temp/renderer-upload-oss-file'
import { supportsApp4_0_0 } from '/@/utils/app-supports'

/**
 * 上传 KYC 图片：磁盘文件走主进程 IPC，内存 File（如 Canvas 压缩产物）走渲染进程 STS 上传。
 */
export async function uploadKycImage(file: File, objectKey: string) {
  if (globalThis.isElectron && supportsApp4_0_0()) {
    const localPath = await globalThis.electronAPI.getPathForFile(file)
    if (localPath)
      return globalThis.electronAPI.send('user:uploadOssFile', { localPath, objectKey })
  }
  return tempUploadOssFile({ objectKey, file })
}
