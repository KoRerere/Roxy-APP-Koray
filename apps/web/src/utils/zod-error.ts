/** Zod 3 `ZodError.errors` 与 Zod 4 `ZodError.issues` 的公共条目形态 */
export interface ZodIssueLike {
  message: string
  path: (string | number)[]
}

/**
 * 读取 Zod 校验失败的 issue 列表。
 * Vite 会把 web 与 `@roxy/shared` 的 `zod` 预构建成同一份 v4，v4 只有 `issues`，没有 v3 的 `errors`。
 */
export function getZodIssues(error: { issues?: ZodIssueLike[], errors?: ZodIssueLike[] }) {
  return error.issues ?? error.errors ?? []
}

/** 读取 Zod 校验失败的第一条错误文案 */
export function getFirstZodIssueMessage(error: { issues?: ZodIssueLike[], errors?: ZodIssueLike[] }) {
  return getZodIssues(error)[0]?.message ?? ''
}
