/** 定义任务类型与返回值类型的映射 */
export interface TaskMap {
  /**  压缩任务，返回压缩后的文件路径 */
  compress: (payload: ZipPayload) => string
  /**  压缩指定的文件集合，返回压缩后的文件路径 */
  compressFiles: (payload: { files: ZipPayload[], dest: string }) => string
  /**  解压任务，返回解压后文件路径  */
  decompress: (payload: ZipPayload) => string
  /**  获取压缩文件大小，传入目标文件路径，返回文件大小  */
  getCompressedSize: (dest: string) => number
  /** 生成设备 ID  */
  genDeviceId: () => string
}

/** 任务选项，定义压缩和解压任务所需的参数 */
export interface ZipPayload {
  src: string
  dest: string
  filters?: string[]
}

/** 任务队列项的定义 */
export interface TaskQueueItem<K extends keyof TaskMap> {
  taskId: number
  task: K
  /** 自动提取参数类型 */
  payload: Parameters<TaskMap[K]>[0]
  /**  自动提取返回值类型 */
  resolve: (value: ReturnType<TaskMap[K]>) => void
  reject: (reason: any) => void
}

/** 通用的 Worker 消息类型 */
export interface WorkerMessage<T = any> {
  status: 'success' | 'error'
  data?: T
  error?: string
  taskId?: number
}
