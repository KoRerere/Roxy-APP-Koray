# read_file 对齐 DSH 读文件工具开发文档

## 背景

`packages/roxy-agent-runtime/src/tools/builtin/read_file.ts` 当前已经支持分页、行号、二进制拒绝和读路径权限，但实现仍然是 Roxy 自有语义：

- 工具名是 `read_file`。
- `offset` 是 0-based，默认 `0`。
- `limit` 默认 `100`，最大 `1000`。
- 支持 `line_numbers:false` 输出无行号纯文本。
- 小文件和显式窗口读取都会先 `readFile(path)` 整文件进内存。
- 大于 `MAX_READ_BYTES` 且未显式传 `limit` 时直接拒绝。
- 输出是 `cat -n` 风格的 `N\tline`，没有 DSH 的 `<path>/<type>/<content>` envelope。
- 超长行被拆成 `N.1` / `N.2` continuation 行。

目标是破坏性迁移到 DSH 的读文件语义：保留 Roxy 对外工具名 `read_file` 和现有权限 guard，但读取、分页、格式化、错误和测试全部按 DSH `read` 工具实现，不保留旧的 0-based / `line_numbers` 兼容分支。

参考实现：

- DSH 工具注册和执行：`/Users/anbin/Projects/deepseek-harness/packages/fs/tool-fs/src/read.ts`
- DSH 路径解析和普通文件校验：`/Users/anbin/Projects/deepseek-harness/packages/fs/tool-fs/src/read-target.ts`
- DSH 窗口化和模型输出格式：`/Users/anbin/Projects/deepseek-harness/packages/fs/tool-fs/src/read-render.ts`
- DSH 本地 FS provider：`/Users/anbin/Projects/deepseek-harness/packages/fs/fs-local/src/index.ts`
- DSH 本地读文件 I/O：`/Users/anbin/Projects/deepseek-harness/packages/fs/fs-local/src/fsio.ts`

## 结论摘要

Roxy 应该抄 DSH 的这几件事：

1. `offset` 改为 1-based，默认 `1`。
2. `limit` 默认值和最大值统一为部署配置上限，建议直接采用 DSH 默认 `2000`。
3. 删除 `line_numbers` 入参，成功结果始终返回行号。
4. 删除“大文件无 offset/limit 就拒绝”的策略，改为按 `stat.size` 路由：小文件整读，大文件或未知大小流式读。
5. 引入纯函数 `buildReadWindow()`，从 `Iterable<string> | AsyncIterable<string>` 构建行号窗口。
6. 单行超过 `readMaxLineLength` 时截断为 `... (line truncated to <max> chars)`，不要再拆成 `N.1` / `N.2`。
7. 选中输出超过 `readMaxBytes` 时停止收集并输出 DSH 的 `Output capped` footer。
8. 模型可见结果改成 DSH envelope：

```text
<path>/abs/file.ts</path>
<type>file</type>
<content>
1: first line
2: second line

(Showing lines 1-2 of 10. Use offset=3 to continue.)
</content>
```

9. 文件不存在、非普通文件、offset 越界、非 UTF-8、二进制文件统一返回 `isError:true`，消息采用 DSH 风格。
10. 保留 Roxy `readPermissionGuard()`，因为 DSH 的 `ctx.fs`/sandbox/policy 层在 Roxy 不存在。

## Roxy 与 DSH 当前差异

| 维度              | Roxy 当前 `read_file`          | DSH `read`                                 | 迁移策略                                                                 |
| ----------------- | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| 工具名            | `read_file`                    | `read`                                     | 保留 `read_file`，只抄行为。                                             |
| 路径字段          | `path`                         | `file_path`                                | 保留 `path`，否则会影响 skill prompt、eviction 文案和现有 runtime 调用。 |
| offset            | 0-based，默认 `0`              | 1-based，默认 `1`                          | 改成 DSH 1-based。                                                       |
| limit             | 默认 `100`，最大 `1000`        | 默认和最大都是 `readLimit`，默认 `2000`    | 改成默认/最大 `2000`。                                                   |
| 可关闭行号        | `line_numbers:false`           | 不支持                                     | 删除入参。                                                               |
| 大文件            | 无显式窗口时拒绝；有窗口也整读 | 大文件或未知 size 流式读                   | 改成 DSH size routing。                                                  |
| 窗口化            | `split('\n')` 后 `slice()`     | chunk 扫描，不让巨行无限增长               | 抄 DSH 扫描器。                                                          |
| 超长行            | 拆成多行 continuation          | 单行截断并加后缀                           | 改成 DSH 截断。                                                          |
| 输出总字节        | 依赖外层 eviction              | 工具内部 `readMaxBytes` capped footer      | 增加 DSH byte cap。                                                      |
| 输出格式          | `N\tline` + Roxy footer        | XML-like envelope + `N: line` + DSH footer | 改成 DSH envelope。                                                      |
| canonical JSON    | 无，只有 `content:string`      | 有 `{ path, offset, lines, totalLines }`   | Roxy `ToolHandlerResult` 仍只能返回 string；内部可用同等结构再 render。  |
| presentation meta | 无                             | 有 `presentationMeta` / read card          | 暂不实现，除非后续 Roxy UI 增加 tool result meta。                       |
| 观察策略          | 无 read-before-write 版本观察  | `fs/observed` 供 write/edit guard          | 暂不抄，Roxy 还没有 `ctx.fs` 版本模型。                                  |

## 目标 schema

`read_file` 保留工具名和 `path` 字段，但参数语义改成 DSH：

```ts
export const readFileInputSchema = z.strictObject({
  path: z.string().min(1).describe('Path to read. Relative paths resolve from the current process working directory.'),
  offset: z.number().int().min(1).default(1).describe('1-based first line to return. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(READ_LIMIT)
    .optional()
    .describe(`Maximum number of lines to return. Defaults to ${READ_LIMIT}.`),
})
```

删除：

```ts
line_numbers: z.boolean().default(true)
```

保留 Roxy 的 `PathPermissions`：

```ts
const guard = await readPermissionGuard(deps, path, 'read_file', ctx)
if (guard) return guard
```

权限 guard 必须在任何 `stat` / `open` / `readFile` / `createReadStream` 之前执行。

## 目标常量

把 `limits.ts` 中 read 相关常量改成 DSH 命名和默认值，或保留 Roxy 导出名但值改成 DSH。推荐用新名字，让代码读起来直接对应 DSH：

```ts
export const READ_LIMIT = 2_000
export const READ_MAX_LINE_LENGTH = 2_000
export const READ_MAX_BYTES = 50 * 1024
export const READ_STREAM_MIN_SIZE = 10 * 1024 * 1024
```

旧常量迁移：

| 旧常量                   | 新常量                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `MAX_READ_LINES_DEFAULT` | `READ_LIMIT`                                                      |
| `MAX_READ_LINES_CEILING` | `READ_LIMIT`                                                      |
| `MAX_LINE_LENGTH`        | `READ_MAX_LINE_LENGTH`                                            |
| `MAX_READ_BYTES`         | 删除或仅保留给 `readBytes` 类工具；`read_file` 不再用它拒绝整读。 |

`middleware/eviction.ts` 里继续需要默认分页行数时，改用 `READ_LIMIT`。它的提示也要从 `offset=N` 0-based 语义更新为 1-based。

## 实现拆分

把 `read_file.ts` 拆成两层，照 DSH 的职责分离：

```text
src/tools/builtin/read_file.ts          # 工具 schema、权限 guard、I/O 调度、错误转 ToolHandlerResult
src/tools/builtin/read_file_render.ts   # 纯函数：窗口化、格式化、语言提示可选
```

如果暂时不想新增文件，也至少把 DSH 的这些纯函数保留为独立导出，方便单测：

- `buildWindow()`
- `formatReadOutput()`
- `parseReadArgs()`

Roxy 没有 DSH 的 `ctx.fs` provider，因此本地 I/O 直接实现为本工具私有 helper：

- `readWholeText(path, signal)`
- `streamWholeText(path, signal)`
- `statRegularFile(path, signal)`

## 读取流程

目标 handler 顺序：

1. Zod 先校验输入并默认 `offset=1`。
2. `parseReadArgs()` 校验 `path.trim()`、`offset`、`limit` 和 cap。
3. `readPermissionGuard()` 执行 Roxy 读权限。
4. `stat(path)`：
   - 不存在：`isError:true`，`cannot read "<path>": not found`
   - 非普通文件：`isError:true`，`cannot read "<path>": not a regular file`
   - 其它 I/O 权限失败：直接返回原始错误消息或归一成 `cannot read "<path>": <message>`
5. size routing：
   - `size >= READ_STREAM_MIN_SIZE`：`streamWholeText(path, signal)`
   - 否则：`[await readWholeText(path, signal)]`
6. `buildWindow(chunks, { offset, limit, maxLineLength, maxBytes }, path)`。
7. `formatReadOutput(path, outcome)`。
8. 返回 `{ content, isError:false }`。

伪代码：

```ts
handler: async (input, ctx) => {
  const parsed = parseReadArgs(input, READ_LIMIT)
  const guard = await readPermissionGuard(deps, parsed.path, 'read_file', ctx)
  if (guard) return guard

  try {
    const info = await statRegularFile(parsed.path, ctx.signal)
    const chunks =
      info.size >= READ_STREAM_MIN_SIZE
        ? streamWholeText(parsed.path, ctx.signal)
        : [await readWholeText(parsed.path, ctx.signal)]
    const window = await buildWindow(
      chunks,
      {
        offset: parsed.offset,
        limit: parsed.limit,
        maxLineLength: READ_MAX_LINE_LENGTH,
        maxBytes: READ_MAX_BYTES,
      },
      parsed.path,
    )
    return {
      content: formatReadOutput(parsed.path, {
        offset: parsed.offset,
        lines: window.lines,
        totalLines: window.totalLines,
        ...(window.truncatedByBytes ? { truncatedByBytes: true } : {}),
      }),
      isError: false,
    }
  } catch (error) {
    return { content: renderReadError(error), isError: true }
  }
}
```

## `buildWindow()` 语义

直接抄 DSH：

- 输入是 decoded text chunks，chunk 边界没有语义。
- 按 `\n` 分行，输出行文本不包含 trailing newline。
- 行尾 `\r` 去掉，使 CRLF 文本展示为普通行。
- 空文件返回 `lines: []`、`totalLines: 0`，`offset=1` 合法。
- 如果 `offset > totalLines` 且不是空文件 `offset=1`，抛 offset 越界错误。
- 超长行只保留前 `READ_MAX_LINE_LENGTH` 个字符，并追加：

```text
... (line truncated to 2000 chars)
```

- `READ_MAX_BYTES` 只限制被选中返回的行，不限制扫描总行数。
- 一旦选中输出超过 byte cap，停止收集后续选中行，标记 `truncatedByBytes:true`。
- 对于一个没有换行、超长、超大文件，line buffer 最多持有 `maxLineLength + 1` 个字符，避免单行撑爆内存。

## 输出格式

成功输出必须改成 DSH envelope：

```text
<path>/absolute/or/relative/path.txt</path>
<type>file</type>
<content>
1: hello
2: world

(End of file - total 2 lines)
</content>
```

footer 三种：

```text
(Output capped. Showing lines <start>-<end>. Use offset=<next> to continue.)
(Showing lines <start>-<end> of <total>. Use offset=<next> to continue.)
(End of file - total <total> lines)
```

空文件：

```text
<path>/tmp/empty.txt</path>
<type>file</type>
<content>
(End of file - total 0 lines)
</content>
```

注意：Roxy 旧输出 `1\thello` 改为 `1: hello`。所有依赖旧格式的测试和 prompt 要一起更新。

## UTF-8 与二进制处理

Roxy 当前只检查 `buf.includes(0)`，然后 `buf.toString('utf8')`。这会把非法 UTF-8 静默替换成 `�`。DSH 的本地 provider 使用 `TextDecoder('utf-8', { fatal: true })`，应该照抄：

- 整读：`readFile(path)` 得到 `Buffer`，前 8192 bytes 检查 NUL，fatal decode。
- 流读：`createReadStream(path, { signal })`，每个 chunk 先做 NUL 采样，再用同一个 fatal `TextDecoder` 跨 chunk decode。
- stream 结束后调用 `decoder.decode()` flush。

错误消息：

```text
cannot read "<path>": binary file
cannot read "<path>": not a UTF-8 text file
read aborted
```

DSH 的 code taxonomy 是 `FsError`，Roxy 当前 `ToolHandlerResult` 没有稳定 error code 字段；先保持 `content` 文本即可。如果未来给工具结果加 `errorKind`，再映射：

| DSH code              | Roxy errorKind 建议 |
| --------------------- | ------------------- |
| `FS_NOT_FOUND`        | `not_found`         |
| `FS_NOT_REGULAR_FILE` | `not_regular_file`  |
| `FS_NOT_TEXT`         | `not_text`          |
| `FS_ABORTED`          | `aborted`           |
| `FS_IO_ERROR`         | `io_error`          |

## 取消信号

所有 I/O 都必须接 `ctx.signal`：

- `stat` 前后检查 `ctx.signal.aborted`。
- `readFile(path, { signal })`。
- `createReadStream(path, { signal })`。
- 捕获 Node `AbortError` 并转成 `read aborted`，不要泄漏裸 `AbortError`。

Roxy 现有 `ToolContext` 已有 `signal`，不需要新增接口。

## 暂不照搬的 DSH 能力

这些能力属于 DSH 的 plugin/provider/session/UI 架构，Roxy 当前没有对应承载点，不应硬塞进 `read_file.ts`：

- `ctx.fs.resolve()` / `FsTargetKey` / opaque target identity。
- `fs/observed` 事件和 read-before-write 版本 guard。
- `presentationMeta` 和 `presentResult` read card。
- `langFromPath()` 语法高亮 hint，除非 Roxy UI 先支持 tool result meta。
- `read_image`，Roxy 当前 `read_file` 只处理 UTF-8 文本。

## 需要更新的 Roxy 文件

### `src/tools/builtin/read_file.ts`

- 删除 `line_numbers` schema 字段。
- `offset` 改为 `.min(1).default(1)`。
- `limit` max 改为 `READ_LIMIT`。
- 删除 `MAX_READ_BYTES` 大文件拒绝分支。
- 删除 `splitOverlongLine()` 使用。
- 增加 DSH 风格 `parseReadArgs()`、size routing、stream/whole text helpers。
- 返回 DSH envelope。

### `src/tools/builtin/read_file_render.ts`

新增或等价拆出：

- `READ_MAX_LINE_LENGTH`
- `READ_MAX_BYTES`
- `buildWindow()`
- `formatReadOutput()`

### `src/tools/builtin/limits.ts`

- 引入 DSH read constants。
- 更新注释，不再描述 `cat -n`、0-based 或“大文件无窗口拒绝”。

### `src/tools/builtin/truncate.ts`

- `splitOverlongLine()` 对 `read_file` 不再使用。
- 如果没有其它调用，可以删除；如果 eviction preview 仍使用 `createContentPreview()`，保留该函数。

### `src/tools/builtin/middleware/eviction.ts`

- 提示改成 1-based：

```text
Use read_file(path="<file>", offset=1, limit=<READ_LIMIT>) to paginate.
```

如果 preview 已显示 head/tail 行号，注意不要让用户以为 offset 仍是 0-based。

### `src/tools/README.md`

- `read_file` 描述改成 DSH envelope、1-based offset、UTF-8 text only、streaming window。

### `src/skills/README.md` / `src/skills/prompt.ts`

如有明确教模型使用 `offset=0` 或 `cat -n` 的文本，改成：

```text
Use read_file with offset and limit. Offset is 1-based.
```

当前 `src/skills/prompt.ts` 只是提到用 `read_file` 读 `SKILL.md`，不需要因为工具输出格式单独改。

## 需要更新的测试

### 替换旧行为测试

这些旧断言必须删除或改写：

- `returns file content with line numbers (cat -n)`：期望改成 DSH envelope + `1: hello world`。
- `returns plain content when line_numbers:false`：删除，因为不再支持 `line_numbers`。
- `paginates with offset+limit and numbers lines`：`offset:10` 现在从第 10 行开始，而不是跳过 10 行。
- `defaults to the first 100 lines`：改成默认 2000 行；测试可构造 2001 行验证 footer。
- `splits overlong lines as N.1 / N.2`：改成单行截断 suffix。
- `refuses whole-file reads above MAX_READ_BYTES without offset`：改成大文件流式读取成功，且不会整读。

### 新增 DSH parity 测试

建议新增或改写到 `test/tools/readFileHardened.test.ts`：

1. 默认读取返回 envelope：

```text
<path>...</path>
<type>file</type>
<content>
1: hello

(End of file - total 1 lines)
</content>
```

2. `offset` 是 1-based：

- 文件 `L1\nL2\nL3`
- `offset:2, limit:1`
- 返回 `2: L2`
- footer `Use offset=3 to continue.`

3. `limit` 超过 `READ_LIMIT` 被 Zod 或 `parseReadArgs()` 拒绝。

4. 空文件成功：

- `lines=[]`
- output 包含 `(End of file - total 0 lines)`

5. offset 越界失败：

```text
offset 9 is out of range for "<path>" (3 lines)
```

6. 大文件或 `size >= READ_STREAM_MIN_SIZE` 走 stream path：

- 可以通过 helper 注入或 spy 拆分测试。
- 如果 `read_file.ts` 直接 import Node I/O，建议把 `readWholeText` / `streamWholeText` 作为导出函数单测，而不是 mock Node 模块。

7. size 未知暂时只在抽象 provider 中有意义；Roxy 本地 `stat` 总会给 size，不需要强造未知 size 分支。

8. NUL binary 返回 `isError:true` 且包含 `binary file`。

9. 非 UTF-8 bytes 返回 `isError:true` 且包含 `not a UTF-8 text file`。

10. abort 转成 `read aborted`。

11. 权限 guard 仍在 I/O 前执行：

- deny path 时不调用 `stat`。
- outside-root ask/reject 行为保持现有 `readFilePermissions.test.ts` 覆盖。

## 迁移风险

这是破坏性迁移，预期会改动模型行为和测试快照：

- 旧的 `offset=0` 调用会变成输入非法。
- 旧的 `offset=N` “跳过 N 行”现在表示“从第 N 行开始”。
- `line_numbers:false` 会被 strict schema 拒绝。
- 输出从 `N\tline` 变成 `N: line`，并被 envelope 包裹。
- 默认返回量从 100 行变成 2000 行，单次上下文占用会增加，但 `READ_MAX_BYTES=50KiB` 会限制实际输出。
- eviction middleware 的 saved result 再分页提示要按 1-based 更新。

因为 Roxy 当前没有外部消费者兼容承诺，这些改动应该一次性完成，不加旧参数 alias，也不做 0-based 自动转换。否则模型会同时看到两套分页语义，反而更容易读错文件窗口。

## 实施顺序

1. 新增 `read_file_render.ts`，先移植并单测 DSH 的 `buildWindow()` / `formatReadOutput()`。
2. 更新 `limits.ts` 的 read constants。
3. 改 `read_file.ts` schema 和 handler，接入权限 guard、stat、whole/stream read、window render。
4. 更新 eviction middleware 的分页提示。
5. 更新 `src/tools/README.md` 中 `read_file` 描述。
6. 改写 `fs.test.ts`、`readFileHardened.test.ts`、`readFilePermissions.test.ts` 里受影响断言。
7. 跑聚焦测试：

```sh
pnpm --filter roxy-agent-runtime test -- readFileHardened
pnpm --filter roxy-agent-runtime test -- fs.test
pnpm --filter roxy-agent-runtime test -- readFilePermissions
pnpm --filter roxy-agent-runtime test -- middleware
```

8. 如果测试脚本不支持文件名过滤，就运行 roxy-agent-runtime 的工具测试子集或包级测试。

## 验收标准

- `read_file` schema 不再包含 `line_numbers`。
- `offset` schema 和描述明确是 1-based。
- 大文件读取不会因为未显式传 `limit` 被拒绝。
- 大文件路径使用 stream，避免把完整文件读进内存。
- 输出完全符合 DSH footer/envelope 语义。
- 空文件、offset 越界、非普通文件、二进制、非法 UTF-8、abort 都有聚焦测试。
- 权限 guard 行为不回退：敏感路径 deny、outside-root ask/reject 仍然生效。
- 所有更新过的测试通过。
