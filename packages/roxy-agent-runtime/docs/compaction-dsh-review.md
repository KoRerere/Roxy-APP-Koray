# Roxy 压缩实现与 dsh 对比评审

这份文档对比当前 `roxy-agent-runtime` 的上下文压缩实现与 dsh 的压缩设计，并记录值得借鉴的改进方向。目标读者是 runtime 维护者，不是最终用户。

## Roxy 当前行为

Roxy 的压缩机制可以概括为：先裁剪 turn 历史，再注入隐藏 summary。

- runtime 会在 `invoke()` 和 `stream()` 的每一次模型请求前检查压缩压力，而不只是 turn 开头检查。这一点很重要，因为一次工具调用结果可能在同一个用户 turn 里把下一次模型请求撑爆。
- 触发判断取两种信号中的较大值：
  - `lastInputTokens`：上一次模型调用返回的 provider 真实 `usage.inputTokens`；
  - `provider.countTokens(history)`：对当前 history 的实时计数或估算。
- 当压力超过 `triggerTokens` 时，`memory.trim()` 会按 `TrimPolicy` 改写 working history。
- 如果配置了 summarizer，runtime 会总结 `trimResult.summarizeText ?? trimResult.archivedText`，写入一条 `compaction` rollout 事件，然后在 history 头部插入隐藏 user message：

```text
Previous conversation summary:
<summary>
...
</summary>
```

- `Message.compactionKey` 和 `compactionOrder` 会在裁剪后恢复宿主注入的上下文，例如 metadata 或 memory snapshot。
- rollout replay 会从最新的 `compaction` 事件恢复：先注入 summary，再 replay `keptMessages`。

这个实现已经是一个实用的客户端压缩机制。主要问题不是“会不会裁剪”，而是“裁剪是否构成可靠的上下文压力控制事务”。

## dsh 的不同点

dsh 把压缩建模为 model-visible history surface 上的一组一等 session event。

- 自动压缩按当前路由模型的 context window 比例触发。
- 默认触发阈值是 `floor(contextWindow * 0.8)`。
- 默认保留最近尾部是 `floor(contextWindow * 0.16)`。
- 在 dsh 当前默认 DeepSeek adapter route 下，模型 context window 解析为 `1_000_000` token，因此默认压力触发点是 `800_000` token，默认保留尾部是 `160_000` token。
- token meter 会 replay session log 并测量当前 surface。压缩发生后，即使下一次普通模型请求还没有返回 usage，它也能立刻反映压缩带来的 token 下降。
- 一次 summary 压缩会写入耐久生命周期事件：
  - `compaction/start`
  - `compaction/summary`
  - replacement `user/message`
  - `compaction/end`
- summary replacement 必须比它替换的范围更小。
- 每次压缩后，dsh 会重新测量压力，并可按配置重试。如果重试后仍高于阈值，就明确失败。
- provider 确认发生 context overflow 时，可以绕过普通阈值，强制做一次有用压缩后重试请求。

dsh 的设计更重，但换来了三个能力：可证明收敛、耐久事务语义、单一 replacement surface。

## Roxy 当前缺口

### 1. 阈值解析需要绑定 `contextWindowTokens`

`AgentGraphDeps` 已经携带 `contextWindowTokens`，注释里也描述了基于比例的触发策略。此前 runtime 实际 fallback 是固定 `150_000` token：

```ts
const triggerTokens = this.deps.triggerTokens ?? 150_000
```

这会让默认行为变得含糊：

- 对 `1_000_000` token 模型来说，`150_000` 非常保守：15% 就开始压缩，而 dsh 是 80%。
- 对 Roxy 当前 `DeepseekProvider` 默认的 `65_536` 来说，`150_000` 完全不保守；它已经超过了 provider 宣称的窗口，可能在压缩前就发出超窗口请求。

默认值已调整为优先从模型容量推导：

```ts
triggerTokens = explicitTriggerTokens ?? Math.floor(contextWindowTokens * 0.8) ?? 150_000
```

如果 provider 暴露了 `contextWindowTokens`，`AgentRuntime.create()` 会在用户没有显式配置时自动把它传入 `AgentGraphDeps`。

### 2. 压缩后没有重新测量压力

Roxy 在 trim 和 summarize 后会直接发送下一次模型请求，没有重新测量压缩后的 history。这样如果 summary 太长、保留的 keyed context 太大，或者最新 tool turn 本身不可拆分，仍然可能超过阈值。

可以借鉴 dsh 的收敛规则：

1. 测量压力。
2. trim 并 summarize。
3. 再测量一次。
4. 如果仍高于阈值，最多重试一个小的次数。
5. 如果重试后仍高于阈值，给出明确的 compaction failure，而不是继续盲目调用 provider。

第一版可以直接用 `provider.countTokens(await memory.getAll(sessionId))` 做 post-check。

### 3. 没有要求 summary 比移除内容更小

`BackgroundSummarizer` 会接受模型返回的任意非空文本，runtime 没有检查 framed summary 是否比 removed range 更小。

可以借鉴 dsh 的 shrink validation：

```ts
summaryTokens < removedTokens
```

初版可以使用 provider count，也可以使用本地 `chars / 4` 估算。精确度不是第一优先级，先拒绝明显变胖的压缩更重要。

### 4. summary 有两套存储路径

当前存在两种 summary 机制：

- `memory.getSummary()` 会在 turn-start 被渲染成 `<compaction_summary>...</compaction_summary>`。
- 真实压缩路径会 prepend 一条隐藏 user message：`Previous conversation summary:\n<summary>...</summary>`。

真实压缩路径没有调用 `setSummary()`。这让 `setSummary/getSummary` 看起来像历史遗留接口或宿主注入接口，而真正的 compaction 使用的是 history message replacement 语义。

建议选择一个 canonical representation：

- 推荐：summary 统一作为普通隐藏 history message，移除或收窄 `setSummary/getSummary` 在压缩路径中的角色。
- 备选：压缩后只调用 `setSummary()`，在 request assembly 时注入唯一 summary，但 rollout replay 也必须重建这份 summary store。

当前 rollout replay 已经围绕 hidden summary message 建好了，所以 hidden-message 路径更贴合现有实现，也更接近 dsh 的 replacement surface 模型。

### 5. trim 先于 summarization 成功

Roxy 先调用 `memory.trim()` 改写 history。如果 summarizer 返回空字符串，旧上下文已经被移除。这个行为符合当前 summarizer “失败不抛错”的约定，但风险是：一次空 summary 会静默丢掉旧上下文。

更稳妥的流程是：

1. 基于当前 snapshot 规划 trim。
2. 对选中的 archive 做 summarization。
3. summary 成功后再一次性提交 trim + summary。

不需要第一步就实现 dsh 那样完整的 event model。较小的改造可以是增加 `memory.planTrim()`，或者让 `trim()` 返回足够数据，使 runtime 能在 summary 成功后再提交。

### 6. 没有 provider overflow recovery

如果 provider 因 context window exceeded 拒绝请求，Roxy 当前会把它当作普通模型错误。dsh 有独立的 `context-overflow` trigger，可以强制做一次最大安全压缩并 retry。

Roxy 可以增加一个定向恢复路径：

- 识别已知 provider context-window 错误。
- 使用最大化裁剪策略 trim。
- 如果有任何 replacement 落地，则 retry 一次。
- 如果没有可用裁剪，则保留原始 provider 错误。

## 推荐实现顺序

1. 修正阈值解析（已采纳）：
   - 默认 trigger 从 `contextWindowTokens * 0.8` 推导；
   - 当宿主没有显式传入 `contextWindowTokens` 时，自动使用 provider 的 `contextWindowTokens`；
   - lifecycle metrics 报告 resolved trigger，而不只是可选的 configured trigger。

2. 抽出共享 compaction helper：
   - `runLoop()` 和 `streamLoop()` 当前重复了同一段压缩逻辑；
   - 抽一个 helper，stream 模式可选择性 emit lifecycle events。

3. 增加压缩后重测：
   - summary 注入后重新 count tokens；
   - 仍高于阈值时 retry 一次；
   - 添加“summary 后仍过大”的回归测试。

4. 增加 shrink validation：
   - summary 不小于 removed range 时拒绝或忽略；
   - emit failed compaction lifecycle event。

5. 统一 summary 表示：
   - 选择 hidden history message 作为 canonical 表示；
   - 将 `setSummary/getSummary` 明确为宿主 turn context 接口，或从 compaction path 移除。

6. 增加 context-overflow recovery：
   - normalize provider context-window errors；
   - 强制做一次 maximal trim/retry。

## 阈值建议

不要直接比较 `150_000` 和 dsh 的 `800_000`。应该比较它们相对于实际路由模型容量的比例。

对于 `1_000_000` token 模型：

| 策略              |    触发点 | 比例 |
| ----------------- | --------: | ---: |
| dsh 默认          | `800_000` |  80% |
| Roxy 当前绝对默认 | `150_000` |  15% |

这种情况下，Roxy 确实非常保守。这不一定错：早压缩可以改善模型注意力、降低延迟。但它应该是明确的产品选择，而不是隐藏 fallback。

对于 Roxy 当前 DeepSeek provider 默认值：

| 策略              |    触发点 | 比例 |
| ----------------- | --------: | ---: |
| provider 默认容量 |  `65_536` | 100% |
| 80% 触发          |  `52_428` |  80% |
| Roxy 当前绝对默认 | `150_000` | 229% |

这种情况下，Roxy 不是保守，而是太晚了。默认值已经超过 provider 宣称的 context window。

已采纳的默认策略：

```ts
const DEFAULT_TRIGGER_RATIO = 0.8
const FALLBACK_TRIGGER_TOKENS = 150_000

const triggerTokens =
  deps.triggerTokens ??
  (deps.contextWindowTokens === undefined
    ? FALLBACK_TRIGGER_TOKENS
    : Math.floor(deps.contextWindowTokens * DEFAULT_TRIGGER_RATIO))
```

然后单独确定 retention budget。与 dsh 对齐的实用默认值是：

```ts
retainTokens = Math.floor(contextWindowTokens * 0.16)
```

如果 Roxy 继续使用 Codex-style retention，可以把这个预算映射到 `retainedUserTokens`，而不是保留完整 mixed-message tail。例如 `1_000_000` token 模型下，保留 `160_000` token 的近期用户上下文已经很充裕；`65_536` token 下，保留约 `10_485` token 会比固定大尾部安全得多。

## 简短结论

如果你的实际 runtime 模型是 `1_000_000` token 窗口，那么旧的 `150_000` 相比 dsh 的 80% 触发确实很保守。我不认为这必然错，因为早压缩能改善上下文聚焦；但它应该是显式策略，而不是默认 fallback。

如果你的实际 runtime 使用当前 Roxy `DeepseekProvider` 默认的 `65_536`，那么旧的 `150_000` 不是保守，而是超过窗口。现在默认已改成 ratio-based，后续再讨论比例该是 60%、70% 还是 80%。
