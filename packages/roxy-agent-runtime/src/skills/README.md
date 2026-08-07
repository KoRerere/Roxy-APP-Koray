# skills

## 1. 模块职责

Skills 是 `SKILL.md` 驱动的 prompt package，不是获得额外权限的工具或脚本运行时。本模块负责严格发现、校验、诊断、Catalog 渲染和显式选择正文加载。

Progressive disclosure 分三层：

1. system 中的 `<skills_instructions>` 以 Markdown 列表只提供 name、description 和 `SKILL.md` locator。
2. 隐式匹配时，模型通过 `read_file` 按需读取 `SKILL.md`。
3. 显式 `SkillSelection { name, path }` 在当前 turn 注入 user-role `<skill>`，references/scripts/assets 仍按需访问。

## 2. 公开接口

- `SkillRegistry`：`scan` / `reload` / `list` / `get` / `diagnostics`。
- `validateSkillFile(path)`：供 authoring/CI 使用的单文件严格校验。
- `scanSkillsWithDiagnostics(root)`：返回 `{ skills, errors, warnings }`。
- `renderSkillCatalog(skills, options)`：渲染带总字符预算的“XML 外壳 + Markdown 内容”Catalog。
- `SkillSelection` / `AgentTurnInput`：显式选择的稳定 `name + path` identity。

严格约束：

- `description` 必填，最长 1024 字符。
- `name` 可省略（默认目录名），最长 64 字符。
- 非法或缺失 frontmatter、错误字段类型、超限文件不会进入 Catalog。
- root 扫描、目录数量、单文件和显式正文均有硬上限。
- 扫描结果按 name、path 确定性排序。

## 3. Prompt 结构

Catalog 是 Anthropic top-level system block：

```xml
<skills_instructions>
## Skills

### Available skills
- git-helper: Common git workflows. (file: /abs/skills/git-helper/SKILL.md)

### How to use skills
- Use a skill when the user explicitly names it or when the task clearly matches its description.
- Before using an implicitly selected skill, read its SKILL.md completely with read_file.
...
</skills_instructions>
```

显式选择正文是仅用于当前 turn 的临时 user message，不写入 memory 或 rollout：

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
- Skill 脚本只能由模型通过普通 `execute` 运行，继续经过 CommandPermissions、HITL、timeout 和输出上限。
- Skill 指令不能扩大 filesystem、command、network 或 approval 权限。
- 不存在 `invoke_skill`，也不会扫描 `scripts/` 自动注册或执行入口。

## 5. 当前范围

- 单个本地 root，直接子目录发现。
- 手动 `reload()`，不含 watcher/changed notification。
- 不含 remote/executor/orchestrator provider。
- 不含 namespace、enable/disable rules 或自动 semantic selector。
