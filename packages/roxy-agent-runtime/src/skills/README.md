# skills

## 1. 模块职责

Skills 是 `SKILL.md` 驱动的 prompt package，不是获得额外权限的工具或脚本运行时。本模块负责严格发现、校验、诊断、Catalog 渲染和显式选择正文加载。

Progressive disclosure 分三层：

1. 顶层 system prompt 的 `## Skills` 区块以 `<skills>` XML 提供 name、description、`SKILL.md` locator 和 Skills 使用规则。
2. 隐式匹配时，模型使用对应 Skill，并按需加载 `SKILL.md`。
3. 显式 `SkillSelection { name, path }` 在当前 turn 注入 user-role `<skill>`，references/scripts/assets 仍按需访问。

## 2. 公开接口

- `SkillRegistry`：`scan` / `reload` / `list` / `get` / `diagnostics`。
- `validateSkillFile(path)`：供 authoring/CI 使用的单文件严格校验。
- `scanSkillsWithDiagnostics(root)`：返回 `{ skills, errors, warnings }`。
- `renderSkillCatalog(skills)`：渲染包含全部有效 Skill 的 XML 渐进披露 Catalog。
- `SkillSelection` / `AgentTurnInput`：显式选择的稳定 `name + path` identity。

严格约束：

- `description` 必填，最长 1024 字符。
- `name` 可省略（默认目录名），最长 64 字符。
- 非法或缺失 frontmatter、错误字段类型、超限文件不会进入 Catalog。
- root 扫描、目录数量、单文件和显式正文均有硬上限。
- 扫描结果按 name、path 确定性排序。

## 3. Prompt 结构

Catalog 是 `ChatRequest.system` 的顶层 system block，provider 将其映射到各自的 system/instructions 字段：

```xml
## Skills

<skills>
  <skill>
    <name>git-helper</name>
    <description>Common git workflows.</description>
    <path>/abs/skills/git-helper/SKILL.md</path>
  </skill>
</skills>
```

显式选择正文是当前 turn 的隐藏 user message，并随该 turn 写入 memory 与 rollout：

```xml
<skill>
<name>git-helper</name>
<path>/abs/skills/git-helper/SKILL.md</path>
---
name: git-helper
description: Common git workflows.
---
# Git helper
...完整 SKILL.md...
</skill>
```

无效、过大或读取失败的显式选择降级为 `<skill_error>`，不会让 agent loop reject。

## 4. 权限边界

- Skill 目录只加入 read allow roots；默认敏感文件 deny 规则仍生效。
- 已存在路径按 realpath 检查，Skill 根内 symlink 逃逸是硬拒绝。
- Skill 脚本只能由模型通过普通 `exec_command` 运行，继续经过 CommandPermissions、HITL、生命周期超时和输出上限。
- Skill 指令不能扩大 filesystem、command、network 或 approval 权限。
- 不存在 `invoke_skill`，也不会扫描 `scripts/` 自动注册或执行入口。

## 5. 当前范围

- 单个本地 root，直接子目录发现。
- 手动 `reload()`，不含 watcher/changed notification。
- 不含 remote/executor/orchestrator provider。
- 不含 namespace、enable/disable rules 或自动 semantic selector。
