/** 定义任务类型与返回值类型的映射 */
export interface TaskMap {
  /**  压缩任务，传入 TaskOptions，返回文件路径 */
  compress: (payload: TaskOptions) => string
  /**  解压任务，传入 TaskOptions，返回文件路径  */
  decompress: (payload: TaskOptions) => string
  /**  获取压缩文件大小，传入目标文件路径，返回文件大小  */
  getCompressedSize: (dest: string) => number
}

/** 任务选项，定义压缩和解压任务所需的参数 */
export interface TaskOptions {
  src: string
  dest: string
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
