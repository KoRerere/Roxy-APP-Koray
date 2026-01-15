/**
 * 深度序列化对象，处理 Error、循环引用等不可序列化的内容
 * 用于 Electron IPC 通信前的数据预处理
 */

/**
 * 序列化 Error 对象
 */
function serializeError(error: Error, seen?: WeakSet<object>): Record<string, any> {
  const serialized: Record<string, any> = {
    message: error.message,
    name: error.name,
    stack: error.stack,
  }

  // 复制其他可枚举属性（深度序列化，避免不可序列化的值）
  for (const key in error) {
    if (Object.prototype.hasOwnProperty.call(error, key)) {
      let value: any
      try {
        value = (error as any)[key]
      }
      catch {
        serialized[key] = '[Serialization Error]'
        continue
      }

      if (value !== undefined && typeof value !== 'function' && typeof value !== 'symbol') {
        try {
          serialized[key] = deepSerialize(value, seen)
        }
        catch {
          serialized[key] = '[Serialization Error]'
        }
      }
    }
  }

  // 追加非枚举的 cause（如果存在）
  const cause = (error as any).cause
  if (cause !== undefined) {
    try {
      serialized.cause = deepSerialize(cause, seen)
    }
    catch {
      serialized.cause = '[Serialization Error]'
    }
  }

  return serialized
}

/**
 * 检查值是否可以安全序列化
 */
function isSerializable(value: any): boolean {
  if (value === null || value === undefined)
    return true

  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean')
    return true
  if (type === 'function' || type === 'symbol')
    return false

  return true
}

/**
 * 深度序列化对象
 * @param obj 要序列化的对象
 * @param seen 已访问的对象集合，用于处理循环引用
 */
export function deepSerialize<T = any>(obj: T, seen = new WeakSet()): any {
  // 基本类型直接返回
  if (obj === null || obj === undefined) {
    return obj
  }

  const type = typeof obj
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return obj
  }

  // 函数和 Symbol 转换为 undefined
  if (type === 'function' || type === 'symbol') {
    return undefined
  }

  // BigInt 转换为字符串
  if (type === 'bigint') {
    return obj.toString()
  }

  // 处理 Date
  if (obj instanceof Date) {
    return obj.toISOString()
  }

  // 处理 RegExp
  if (obj instanceof RegExp) {
    return obj.toString()
  }

  // 处理 Error
  if (obj instanceof Error) {
    return serializeError(obj, seen)
  }

  // 处理数组
  if (Array.isArray(obj)) {
    // 检查循环引用
    if (seen.has(obj)) {
      return '[Circular]'
    }
    seen.add(obj)

    return obj.map(item => deepSerialize(item, seen))
  }

  // 处理普通对象
  if (type === 'object') {
    // 检查循环引用
    if (seen.has(obj)) {
      return '[Circular]'
    }
    seen.add(obj)

    const serialized: Record<string, any> = {}

    try {
      // 遍历所有可枚举属性
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = (obj as any)[key]

          // 跳过函数和 Symbol
          if (typeof value === 'function' || typeof value === 'symbol') {
            continue
          }

          try {
            serialized[key] = deepSerialize(value, seen)
          }
          catch (e) {
            // 如果某个属性序列化失败，跳过它
            serialized[key] = '[Serialization Error]'
          }
        }
      }

      // 处理 Symbol 属性（如果有的话）
      const symbolKeys = Object.getOwnPropertySymbols(obj)
      for (const symbolKey of symbolKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, symbolKey)
        if (descriptor && descriptor.enumerable) {
          const value = (obj as any)[symbolKey]
          if (typeof value !== 'function' && typeof value !== 'symbol') {
            try {
              serialized[symbolKey.toString()] = deepSerialize(value, seen)
            }
            catch (e) {
              // 忽略
            }
          }
        }
      }
    }
    catch (e) {
      // 如果对象不可遍历，返回字符串表示
      return String(obj)
    }

    return serialized
  }

  // 其他情况尝试转换为字符串
  try {
    return String(obj)
  }
  catch (e) {
    return '[Unknown]'
  }
}

/**
 * 安全地序列化 IPC 消息参数
 * 自动检测并处理不可序列化的内容
 */
export function serializeIPCArgs(...args: any[]): any[] {
  return args.map(arg => deepSerialize(arg))
}
