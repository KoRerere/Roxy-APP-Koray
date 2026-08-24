# exec_command 开发文档

## 背景

`packages/roxy-agent-runtime/src/tools/builtin/execute.ts` 是 Roxy agent 现有的内置命令执行工具。下一版将进行破坏性升级：不保留旧的 `execute` 工具名和旧入参，直接迁移到 Codex 风格的 `exec_command` / `write_stdin` 能力模型。

现有实现已经具备这些基础能力：

- macOS/Linux 通过 `/bin/bash` 执行命令，支持 Bash 语法。
- Windows 使用系统 shell。
- 支持 `cwd`、`timeoutMs`、stdout/stderr 捕获、输出截断。
- Unix-like 主机使用独立进程组，超时后杀整个进程组；Windows 使用 `taskkill /T /F` 清理子进程树。
- 工具通过标准 `annotations` 标记破坏性和 open-world 行为，由上游 HITL 处理审批；`CommandPermissions` 在 handler 内执行硬拒绝。

目标是让 Roxy 的命令执行能力直接对齐 Codex 的 `exec_command`，但不引入 Codex 的沙箱模型。Roxy 没有沙箱，因此不暴露 `sandbox_permissions`、`additional_permissions`、`require_escalated`、`prefix_rule` 这些字段，也不实现“沙箱失败后重试非沙箱执行”的分支。

## Codex exec_command 的可借鉴设计

Codex 当前的 shell 工具不是单纯绑定 bash，而是一个 shell-like execution pipeline：

1. 工具 schema 暴露 `cmd`、`workdir`、`tty`、`yield_time_ms`、`max_output_tokens`，以及可选 `shell`、`login`、`environment_id`。
2. 运行前解析环境、cwd、shell、登录 shell 策略、审批/权限。
3. 将用户命令包装成宿主 shell argv，例如 bash/zsh/sh 使用 `-c` 或 `-lc`，PowerShell 使用 `-Command`，cmd 使用 `/c`。
4. 执行层维护进程 ID 和输出缓冲；命令未结束时返回 `session_id`。
5. 后续通过 `write_stdin` 向同一进程写入 stdin 或轮询输出。
6. 输出有硬上限，避免单个命令把上下文或进程内存打爆。

Roxy 应借鉴 1、3、4、5、6，但把第 2 点里的沙箱部分替换成现有 HITL、`CommandPermissions` 和取消信号。

## 命名与破坏性迁移策略

新版本只暴露：

```text
exec_command
write_stdin
```

旧工具名 `execute` 直接删除或停止注册，不做 alias，不做 provider 层兼容，不接受旧参数。

命名迁移：

| 旧           | 新                                                                             |
| ------------ | ------------------------------------------------------------------------------ |
| `execute`    | `exec_command`                                                                 |
| `command`    | `cmd`                                                                          |
| `cwd`        | `workdir`                                                                      |
| `timeoutMs`  | 不再作为主要等待机制；由 `yield_time_ms` 控制首包等待，后台进程由 manager 管理 |
| `MAX_OUTPUT` | `max_output_tokens`                                                            |
| 无           | `write_stdin`                                                                  |

注册策略：

- `registerBuiltinTools()` 中移除 `executeTool()`，改为注册 `execCommandTool()` 和 `writeStdinTool()`。
- 测试全部改用新工具名和新入参。
- HITL、trajectory、日志、UI 文案都以 `exec_command` 为 canonical tool name。
- 不保留 `execute` 的别名、schema transform 或错误提示兼容。

## 目标能力

### exec_command

目标输入完全采用 Codex 可用字段的命名：

```ts
{
  cmd: string
  workdir?: string
  tty?: boolean
  yield_time_ms?: number
  max_output_tokens?: number
  shell?: string
  login?: boolean
}
```

字段语义：

| 字段                | 语义                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `cmd`               | 要执行的 shell 命令，不能为空。                                                                                                     |
| `workdir`           | 工作目录。默认使用 agent 当前工作目录或 runtime 注入的 turn cwd。                                                                   |
| `tty`               | 是否分配交互式终端。无 PTY 依赖时先支持 `false`，实现 `true` 需要引入 `node-pty` 或等价能力。                                       |
| `yield_time_ms`     | 首次调用最多等待多久再返回。命令未结束时返回 `session_id`。默认 `10000`，建议限制在 `250..30000`。                                  |
| `max_output_tokens` | 本次 tool result 的输出预算。语义与 Codex 对齐为 token 预算；实现上可按 `tokens * 4` 近似字节/字符预算。默认 `10000`。              |
| `shell`             | 可选 shell 二进制。Unix-like 默认 `/bin/bash`；Windows 默认系统 shell。只允许识别的 shell 类型，避免模型传任意 wrapper 伪装 shell。 |
| `login`             | 是否使用登录 shell 语义。默认 `false` 更稳，只有明确需要用户 profile 时才启用。                                                     |

不支持字段：

| Codex 字段               | Roxy 策略                                                 |
| ------------------------ | --------------------------------------------------------- |
| `environment_id`         | 暂不支持。Roxy 当前没有多执行环境选择模型。               |
| `sandbox_permissions`    | 不支持。Roxy 没有沙箱。                                   |
| `additional_permissions` | 不支持。Roxy 没有沙箱内追加权限模型。                     |
| `justification`          | 不支持。审批由 HITL 统一处理，不由工具入参驱动。          |
| `prefix_rule`            | 不支持。Roxy 的命令策略继续由 `CommandPermissions` 管理。 |

模型可见 tool result 继续使用当前 `ToolResult.content: string`，但文本格式直接借鉴 Codex `exec_command`：

```text
Chunk ID: abc123
Wall time: 0.1234 seconds
Process exited with code 0
Original token count: 42
Output:
hello
```

命令仍在运行时：

```text
Chunk ID: abc123
Wall time: 10.0031 seconds
Process running with session ID 1234
Original token count: 2048
Output:
partial output
```

输出被截断时：

```text
Chunk ID: abc123
Wall time: 0.1234 seconds
Process exited with code 0
Original token count: 20000
Output:
Warning: truncated output (original token count: 20000)
...[omitted 12345 bytes]...
head/tail output
```

格式约定：

- `Chunk ID` 每次 `exec_command` / `write_stdin` 返回都生成一个短随机 id，方便日志和多轮输出对齐。
- `Wall time` 使用秒，保留 4 位小数，和 Codex 一致。
- 进程结束时写 `Process exited with code N`。
- 进程仍在运行时写 `Process running with session ID N`，这里的 session ID 对应 `write_stdin.session_id`。
- 有原始 token 估算时写 `Original token count: N`；如果实现还没有 token 估算，可用近似值 `Math.ceil(bytes / 4)`。
- 最后一段固定写 `Output:`，后面放 stdout/stderr 合并后的模型可见输出。
- stdout/stderr 可以在内部独立保存，但模型可见输出合并为 `Output:`，更贴近 Codex `exec_command`。
- 非 0 exit code 不等于 tool error；工具成功启动并拿到进程结果时，`isError` 仍应为 `false`。
- `isError` 只在输入非法、权限拒绝、启动失败、超时、abort、未知 session、stdin 写入失败等工具层错误时为 `true`。
- 输出超预算时在 `Output:` 内追加 Codex 风格的 warning 和 omission marker；不要额外发明 `output_truncated:` 字段。

可选：如果未来为 code mode 或内部调试提供结构化结果，可另行返回 JSON：

```ts
{
  chunk_id?: string
  wall_time_seconds: number
  exit_code?: number
  session_id?: number
  original_token_count?: number
  output: string
}
```

但普通模型 tool result 以文本格式为准。

### write_stdin

新增内置工具：

```text
write_stdin
```

输入：

```ts
{
  session_id: number
  chars?: string
  yield_time_ms?: number
  max_output_tokens?: number
}
```

语义：

- `chars` 非空：向指定后台进程写入 stdin，再等待一小段时间收集输出。
- `chars` 为空或省略：只轮询输出，不写入。
- 进程结束时返回 `exit_code`，并从进程表移除。
- 未知 `session_id` 返回 `isError: true`，不要抛出异常。

没有 PTY 时的阶段性限制：

- 对 `tty: false` 的普通 pipe 进程，只支持空轮询；非空 `chars` 返回明确错误。
- 真正交互式 shell、REPL、全屏 TUI 需要 `tty: true` + PTY 实现。

## 进程管理设计

新增一个小的 process manager，不要把所有状态堆进 `execute.ts`。

建议文件：

```text
src/tools/builtin/exec_command_process_manager.ts
```

核心状态：

```ts
interface ExecCommandProcessEntry {
  session_id: number
  cmd: string
  workdir?: string
  child: ChildProcess
  stdoutChunks: Buffer[]
  stderrChunks: Buffer[]
  startedAt: number
  lastUsedAt: number
  lifetimeTimer?: NodeJS.Timeout
  terminationReason?: 'timeout' | 'aborted' | 'killed'
  closed: boolean
  exitCode?: number
  signal?: NodeJS.Signals | null
  tty: boolean
}
```

要求：

- session id 由 manager 分配，测试环境可提供确定性 id。
- 每个后台进程只允许一个 `write_stdin`/poll 同时操作，避免读写输出缓冲互相抢数据。
- 后台进程数量要有上限，例如 64；超过上限优先清理已退出或最久未使用的进程。
- 进程退出、内部生命周期超时、上游取消时必须清理 timer 和进程表。
- Unix-like 继续使用 `detached: true` 和负 PID 杀进程组。
- Windows 继续使用 `taskkill /pid <pid> /T /F`。

## Shell 解析与 argv 构造

抽出 shell 逻辑，避免 `spawn(command, { shell })` 的语义散落在 handler 里。

建议文件：

```text
src/tools/builtin/exec_command_shell.ts
```

目标函数：

```ts
type ShellType = 'bash' | 'zsh' | 'sh' | 'powershell' | 'cmd'

interface ResolvedShell {
  type: ShellType
  path: string | true
}

function defaultShellForHost(): ResolvedShell
function resolveRequestedShell(shell?: string): ResolvedShell
function buildShellCommand(
  shell: ResolvedShell,
  command: string,
  login: boolean,
): {
  file: string
  args: string[]
  shell: false
}
```

优先使用 `spawn(file, args, { shell: false })`，而不是 `spawn(command, { shell })`。这样 shell 路径、`-c/-lc`、PowerShell 参数都由我们显式控制，和 Codex 的 `derive_exec_args` 思路一致。

映射规则：

| shell type  | argv                                              |
| ----------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| bash/zsh/sh | `<shell> -c <command>` 或 `<shell> -lc <command>` |
| powershell  | `<pwsh                                            | powershell> -NoProfile -Command <command>`，`login:true`时可省略`-NoProfile` |
| cmd         | `cmd.exe /c <command>`                            |

当前 Unix-like 默认 `/bin/bash` 是正确方向，必须保留；否则 Bash process substitution 等语法会退化到 `/bin/sh` 并失败。

## 权限、HITL 与无沙箱边界

Roxy 没有 Codex 沙箱，因此安全边界应写清楚：

- `exec_command` 通过标准 `annotations` 触发 strict/delegate HITL。
- `CommandPermissions` 的 `deny` 是 handler 内硬拒绝，在任何 HITL 模式下都生效。
- `allow` / `ask` 的交互仍由 HITL 层处理，`exec_command` handler 不重复实现审批 UI。
- 工具名迁移后，HITL 需要识别 `exec_command` 为敏感工具，而不是 `execute`。
- 不暴露 `sandbox_permissions`。没有沙箱时，`require_escalated` 没有实际意义，暴露它会误导模型。
- 不做沙箱失败检测和重试。
- 不伪造“只读/工作区写”承诺；命令拥有当前 Roxy agent 进程的 OS 权限。

## 取消与超时

`exec_command` 和 `write_stdin` 都要接入 `ToolContext.signal`：

- signal abort 时终止进程树，返回 `{ isError: true, content: 'exec_command: aborted' }` 或对应稳定格式。
- `exec_command` 的后台进程需要有 manager 级最大存活时间，避免进程永久泄漏。这个生命周期上限不是模型入参，建议先用内部默认值或 runtime 配置，并允许测试注入较短值。
- 内部生命周期超时和 abort 都必须等待 close，但要设置短 drain 上限，避免子进程继承 stdout/stderr 后导致永久等待。
- Unix-like 进程树清理回归用例必须覆盖 `sleep 60 | cat`，通过测试注入短生命周期或触发 abort 验证它能快速返回。

## 输出缓冲与截断

当前实现按 stdout/stderr 字符串总量截断。对齐 Codex 时建议改成 head/tail 缓冲：

- 内存总缓冲硬上限，例如 1 MiB。
- 单次 tool result 使用 `max_output_tokens` 再次截断。
- 截断时保留开头和结尾，中间用明确标记：

```text
...[omitted 12345 bytes]...
```

这样模型既能看到命令开头错误，也能看到最后退出信息。

## 实施步骤

1. 先做破坏性命名迁移：
   - 新增 `exec_command.ts`，导出 `execCommandTool()`。
   - 新增 `write_stdin.ts`，导出 `writeStdinTool()`。
   - 从 `registerBuiltinTools()` 移除 `executeTool()`。
   - 删除或废弃 `execute.ts`，不注册旧工具名。
   - 更新所有测试、HITL 断言、trajectory 断言和 provider schema 断言。

2. 新增回归测试，锁定执行行为：
   - Bash process substitution 在 Unix-like 可运行。
   - `sleep 60 | cat` 在测试注入的短生命周期或 abort 下快速返回。
   - `CommandPermissions` deny 返回 `isError`。
   - 非 0 exit code 返回 `isError: false`，并在内容中包含 `Process exited with code N`。

3. 抽出 shell 构造：
   - 从旧 `execute.ts` 迁移或重写 `shellForHost()`。
   - 使用显式 `spawn(file, args, { shell: false })`。
   - 保持 Unix-like 默认 Bash，Windows 默认系统 shell。

4. 抽出 process manager：
   - 支持 session id、后台进程表、输出缓冲、进程清理。
   - `exec_command` 在 `yield_time_ms` 内未结束时返回 `session_id`。

5. 新增 `write_stdin` builtin：
   - 注册到 `registerBuiltinTools()`。
   - 非空 stdin 先仅支持 PTY 或明确支持 stdin pipe 的进程。
   - 空 poll 必须可用。

6. 接入 `ctx.signal`：
   - abort 时杀进程树。
   - 统一 close/drain 逻辑。

7. 输出格式稳定化：
   - 使用 Codex 风格文本：`Chunk ID`、`Wall time`、`Process exited with code` / `Process running with session ID`、`Original token count`、`Output:`。
   - 对仍在运行的进程输出 `Process running with session ID N`。
   - 对非 0 exit code 保持 `isError: false`。

8. 更新提示词/工具描述：
   - 描述真实宿主 shell 差异。
   - 明确没有沙箱，命令应尽量使用 `workdir` 而不是 `cd`。
   - 不承诺 Codex 沙箱字段。

## 测试清单

必须覆盖：

- 成功命令返回 exit code 0。
- 非零 exit code 返回 `isError: false`，内容包含 `Process exited with code N`。
- 缺少 `cmd` 返回 `isError: true`。
- Unix-like Bash 语法：`diff <(printf a) <(printf a)`。
- Unix-like pipeline 清理：`sleep 60 | cat` 在短生命周期或 abort 后 2 秒内返回。
- 超时后子进程树被清理。
- `ctx.signal` abort 清理进程并返回错误结果。
- 输出超过预算时被截断，并包含 `Warning: truncated output` 或 omission marker。
- 长命令首次 `exec_command` 返回 `Process running with session ID N`。
- `write_stdin` 空 poll 能拿到后续输出。
- 进程结束后再次 `write_stdin` 返回 unknown session。
- `CommandPermissions` deny 优先于执行。
- `registerBuiltinTools()` 暴露 `exec_command` 和 `write_stdin`，不暴露 `execute`。
- provider 投影中只有新工具名和新入参。

可选覆盖：

- Windows `taskkill` 参数。
- PowerShell 命令参数构造。
- `shell` 指定未知值时回退或拒绝；建议拒绝并返回 `isError`。

## 不做清单

- 不实现 Codex 沙箱。
- 不实现 `sandbox_permissions`、`additional_permissions`、`require_escalated`、`prefix_rule`。
- 不保留 `execute` 兼容入口。
- 不支持旧入参 `command`、`cwd`、`timeoutMs`。
- 不在 handler 内绕过 HITL 自己弹审批。
- 不让模型传任意 shell wrapper 作为执行入口。
- 不让输出无限增长。
