# SQLite Checkpointer 查询变慢问题定位

## 现象

- 数据库约 50MB 时，与 AI 对话明显变慢；删除 DB 重新来则很快。
- 说明：**随数据量增大，读路径（尤其是 getTuple）变慢**，与库体积强相关。

## 调用链（与 deepagents/LangGraph 的关系）

- **deepagents** 使用 LangGraph 的 `CompiledGraph`，每步执行前后会：
  - **getTuple(config)**：加载当前 thread 的「最新」或「指定」checkpoint（含 pending_writes / pending_sends），用于恢复状态。
  - **put(config, checkpoint, metadata)**：写入一条 checkpoint 行（整份状态 BLOB）。
  - **putWrites(config, writes, taskId)**：写入该 checkpoint 的多条 writes（channel 增量）。
- 对话流中 **每一步**（LLM 调用、tool 调用、图节点切换）都会触发 **至少一次 getTuple**，因此 getTuple 是绝对的热路径。

## 慢在哪里

### 1. getTuple 的主查询 + 两个相关子查询

```sql
SELECT
  ...,
  (SELECT json_group_array(json_object(..., CAST(pw.value AS TEXT)) ) FROM writes pw
   WHERE pw.(thread_id, checkpoint_ns, checkpoint_id) = checkpoints.(...)
  ) as pending_writes,
  (SELECT json_group_array(...) FROM writes ps
   WHERE ps.(thread_id, checkpoint_ns, parent_checkpoint_id) AND ps.channel = 'TASKS'
   ORDER BY ps.idx
  ) as pending_sends
FROM checkpoints
WHERE thread_id = ? AND checkpoint_ns = ? [AND checkpoint_id = ? | ORDER BY checkpoint_id DESC LIMIT 1]
```

- **checkpoints**：主键 `(thread_id, checkpoint_ns, checkpoint_id)` 能支撑 WHERE 和「取最新一条」的 ORDER BY checkpoint_id DESC LIMIT 1。
- **pending_writes 子查询**：按 `(thread_id, checkpoint_ns, checkpoint_id)` 查 writes，与 writes 的 PK 前缀一致，可用索引。
- **pending_sends 子查询**：按 `(thread_id, checkpoint_ns, parent_checkpoint_id)` 且 **channel = 'TASKS'**。writes 的 PK 是 `(thread_id, checkpoint_ns, checkpoint_id, task_id, idx)`，**没有 channel**，因此无法按 channel 做索引查找，只能取该 checkpoint 下所有 writes 再过滤，写多时成本高。

结论：**pending_sends 子查询缺 (thread_id, checkpoint_ns, checkpoint_id, channel) 上的索引，随 writes 行数/体积增大明显变慢。**

### 2. 大 BLOB 读取与反序列化

- **checkpoints.checkpoint**、**checkpoints.metadata**、**writes.value** 均为 BLOB；getTuple 会：
  - 读出一整行 checkpoint + 所有该 checkpoint 的 writes（含 value）。
  - 对每个 write 做 `CAST(pw.value AS TEXT)` 再 JSON 聚合，并在 JS 里 `serde.loadsTyped`。
- 若单次对话曾写入很多、很大的 writes（例如长对话、大 state），即使剪枝后只保留 1 个 checkpoint，**该 checkpoint 对应的 writes 行数和单行 value 大小**仍可能很大，导致单次 getTuple 的 I/O 和反序列化都很重。

### 3. list() 的 N+1 与动态 SQL

- list() 根据 filter 拼 WHERE，**每次调用都 `db.prepare(sql)`**，有少量额外开销。
- 对 list 返回的**每一行**，都会在应用层再反序列化 checkpoint / pending_writes（list 的 SQL 里同样带两个相关子查询），相当于「主查询 + 每行两遍子查询」。若 list 返回多行，总成本成倍增加。通常对话流里 list 调用次数远少于 getTuple，但若某处频繁 list 且 limit 大，也会放大问题。

### 4. 无额外 PRAGMA 调优

- 仅设置了 `journal_mode=WAL`，未设置：
  - **cache_size**：默认页缓存较小，大库时命中率不足，更多读落盘。
  - **synchronous**：默认 FULL，写稳但更慢；对 checkpoint 可考虑 NORMAL 在安全与性能间折中。
  - **temp_store**：临时表/排序在内存可减少磁盘 I/O。

## 优化建议（已实现 / 可做）

1. **为 writes 增加复合索引**  
   `(thread_id, checkpoint_ns, checkpoint_id, channel)`  
   - 让 pending_sends 子查询能按 channel 做索引查找，减少对整段 writes 的扫描与过滤。

2. **setup() 里增加 PRAGMA**  
   - `PRAGMA cache_size = -64000`（约 64MB 缓存，按需调整）。  
   - `PRAGMA temp_store = MEMORY`。  
   - 视需求 `PRAGMA synchronous = NORMAL`（在可接受断电/崩溃风险时）。

3. **保持剪枝策略**  
   - 对话结束后对当前 thread 调用 `pruneThreadCheckpoints(threadId, 1)`，只保留最新 1 个 checkpoint，控制单 thread 的 checkpoint 与 writes 行数，减轻单次 getTuple 的数据量。

4. **后续可考虑**  
   - 若单 checkpoint 的 writes 行数仍很多：在应用层限制单次对话的步数或对 state 做更激进的压缩/裁剪。  
   - 若 list() 在热路径且返回行数多：对 list 结果做 limit、或对 list 的 SQL 做只读最新 N 条的优化。

## 小结

- **慢的主要来源**：getTuple 中 **pending_sends 子查询** 在 writes 表上缺 (thread_id, checkpoint_ns, checkpoint_id, channel) 索引，加上大 BLOB 读取与反序列化；库到 50MB 后，每次 getTuple 的 I/O 和 CPU 都明显增加。
- **已做**：为 writes 增加上述索引，并在 setup() 中增加 cache_size、temp_store（及可选 synchronous）的 PRAGMA，以降低读成本、提高缓存命中率。
