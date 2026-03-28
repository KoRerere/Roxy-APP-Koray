# RoxyBrowser OpenAPI Skills

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/roxybrowser/roxybrowser-openapi-skills)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)

> **A Claude Code skill for efficient RoxyBrowser MCP tool selection and usage guidance.**

This skill helps Claude (and other LLMs) understand when and how to use RoxyBrowser MCP tools, reducing token consumption by ~60% while improving tool selection accuracy.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [File Structure](#file-structure)
- [Skill Configuration](#skill-configuration)
- [Quick Reference](#quick-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

### What is this skill?

This is an **Agent Skill** for Claude Code that provides:

1. **Tool Selection Guidance** - Quick decision matrix mapping user intents to RoxyBrowser MCP tools
2. **Workflow Templates** - Common automation scenarios with step-by-step tool sequences
3. **Error Prevention** - Critical rules and common error handling (especially quota management)
4. **Token Optimization** - Progressive disclosure to minimize context usage

### Why use this skill?

| Without Skill | With Skill |
|--------------|------------|
| Load full MCP tool docs (~5000+ tokens) | Load concise guidance (~2000 tokens) |
| LLM guesses which tool to use | Clear decision matrix for tool selection |
| Common mistakes (close vs delete) | Critical rules prevent errors |
| No workflow guidance | Step-by-step scenario templates |

### Token Savings

```
Full MCP Documentation:  ~5000+ tokens
This Skill (core):       ~2000 tokens
Savings:                 ~60%
```

---

## Features

### Core Features

- **Quick Decision Matrix** - 11 common user intents mapped to specific tools
- **30+ Tools Categorized** - Organized into 6 functional groups
- **4 Common Scenarios** - Pre-built workflow templates
- **Critical Rules** - Quota management, parameter binding, best practices
- **Error Prevention** - Common error codes with solutions

### Progressive Disclosure

Load additional detail only when needed:

| File | When to Load | Content |
|------|-------------|---------|
| `SKILL.md` | Always | Core guidance, decision matrix |
| `guides/tool-selection.md` | Complex decisions | Flowchart decision trees |
| `guides/common-errors.md` | Error handling | 12 error codes, bilingual support |
| `examples/basic-workflow.md` | Step-by-step help | 6 complete workflow examples |

### Bilingual Error Support

Recognizes both Chinese and English error messages:

| Chinese | English | Code |
|---------|---------|------|
| 额度不足 | Insufficient quota | 409/101 |
| 认证失败 | Authentication failed | 401 |
| 浏览器不存在 | Browser not found | 404 |

---

## Installation

### Option 1: Claude Code Skills Directory (Recommended)

```bash
# Clone or copy to Claude Code skills directory
cp -r roxybrowser-openapi-skills ~/.claude/skills/

# Or create symlink
ln -s /path/to/roxybrowser-openapi-skills ~/.claude/skills/roxybrowser-openapi
```

### Option 2: Project-Level Skills

```bash
# Place in your project's skills directory
mkdir -p your-project/.claude/skills
cp -r roxybrowser-openapi-skills your-project/.claude/skills/
```

### Option 3: Manual Loading

Reference the skill directly in your Claude Code session:

```
User: Load the skill from /path/to/roxybrowser-openapi-skills/SKILL.md
```

### Prerequisites

- **RoxyBrowser Application** - Must be installed and running
- **RoxyBrowser MCP Server** - Must be configured in Claude Code
- **Environment Variables**:
  ```bash
  export ROXY_API_KEY="your_api_key_here"
  export ROXY_API_HOST="http://127.0.0.1:50000"  # Optional, default shown
  export ROXY_TIMEOUT="30000"                    # Optional, in milliseconds
  ```

---

## Usage

### Automatic Loading

The skill automatically loads when user input contains trigger keywords:

- `roxybrowser`, `roxy browser`, `roxy_`
- `fingerprint browser`, `anti-detect browser`
- `browser automation`, `cdp endpoint`
- `browser profile`, `proxy browser`

### Manual Loading

```
User: /skill roxybrowser-openapi
```

### How Claude Uses This Skill

1. **User Request**: "I want to automate a browser task"
2. **Skill Loaded**: Claude reads `SKILL.md`
3. **Decision Matrix**: Claude checks Quick Decision Matrix
4. **Tool Selection**: Identifies `roxy_create_browser` → `roxy_open_browser`
5. **Workflow**: Follows Common Scenarios template
6. **Error Handling**: Uses Critical Rules to prevent mistakes

### Example Conversation

```
User: I keep getting error 409 when creating browsers

Claude: [Loads skill.md, checks error codes]
        Error 409 means "Insufficient quota". This is a common issue.

        ⚠️ IMPORTANT: You must DELETE browsers to free quota, not just close them.

        Let me help you free up quota:
        1. First, let me list your browsers...
        [Calls roxy_list_browsers]

        2. Which browsers would you like to delete?
        [User selects]

        3. Deleting selected browsers...
        [Calls roxy_delete_browsers]

        ✅ Quota freed! You can now create new browsers.
```

---

## File Structure

```
roxybrowser-openapi-skills/
├── SKILL.md                    # Main skill file with metadata
├── README.md                   # This documentation
├── guides/
│   ├── tool-selection.md      # Decision tree flowcharts
│   └── common-errors.md       # Error codes and solutions
└── examples/
    └── basic-workflow.md      # Step-by-step workflow examples
```

### File Descriptions

| File | Size | Purpose |
|------|------|---------|
| `SKILL.md` | ~4KB | Core skill with metadata, decision matrix, critical rules |
| `guides/tool-selection.md` | ~3KB | Flowchart decision trees for complex scenarios |
| `guides/common-errors.md` | ~4KB | 12 error codes, bilingual support, troubleshooting |
| `examples/basic-workflow.md` | ~5KB | 6 complete workflow examples with timing |

---

## Skill Configuration

### Metadata (YAML Frontmatter)

The skill includes metadata in `SKILL.md`:

```yaml
---
name: automating-roxybrowser
description: Guides tool selection and usage for RoxyBrowser MCP Server browser automation. Use when working with RoxyBrowser, anti-detect browsers, fingerprint browsers, CDP endpoints, browser profiles, or proxy-enabled automation.
---
```

### Configuration Options

The skill follows Anthropic's best practices with a minimal frontmatter containing only `name` and `description` fields. The description includes trigger conditions to help Claude identify when to load this skill.

---

## Quick Reference

### Tool Categories

| Category | Tools | Use When |
|----------|-------|----------|
| **Discovery** | `roxy_list_workspaces`, `roxy_list_browsers` | Finding resources |
| **Lifecycle** | `roxy_create_browser`, `roxy_open_browser`, `roxy_close_browsers`, `roxy_delete_browsers` | Managing browser lifecycle |
| **Configuration** | `roxy_update_browser`, `roxy_random_fingerprint` | Modifying browsers |
| **Proxy** | `roxy_list_proxies`, `roxy_create_proxy`, `roxy_detect_proxy` | Proxy management |
| **Accounts** | `roxy_list_accounts`, `roxy_create_account` | Credential storage |
| **Diagnostics** | `roxy_system_diagnostics`, `roxy_validate_proxy_config` | Troubleshooting |

### Critical Rules

```
⚠️ QUOTA MANAGEMENT
- roxy_close_browsers → Does NOT free quota
- roxy_delete_browsers → DOES free quota
- Error 409/101 = Must DELETE, not close

🔑 REQUIRED PARAMETERS
- Almost all tools need workspaceId
- Get it from roxy_list_workspaces first

🛠️ PARAMETER BINDING
- Proxy: Use moduleId OR full config (not both)
- Account: Use id OR credentials (not both)
```

### Common Workflows

```
CREATE & AUTOMATE:
roxy_list_workspaces → roxy_create_browser → roxy_open_browser → [automation] → roxy_close_browsers

FREE QUOTA:
roxy_list_browsers → roxy_delete_browsers (NOT close!)

TROUBLESHOOT:
roxy_system_diagnostics(verbose: true)
```

---

## Examples

### Example 1: First-Time Automation

```
1. roxy_list_workspaces
   → Get workspaceId: 1

2. roxy_create_browser(workspaceId: 1, windowName: "My Browser")
   → Get dirId: "abc123"

3. roxy_open_browser(workspaceId: 1, dirId: "abc123")
   → Get CDP URL: "ws://127.0.0.1:52314/devtools/browser/abc123"

4. [User automation with Playwright/Puppeteer]

5. roxy_close_browsers(dirIds: ["abc123"])
```

### Example 2: Proxy-Enabled Browser

```
1. roxy_list_proxies(workspaceId: 1)
   → Get moduleId: 42

2. roxy_create_browser(workspaceId: 1, proxyInfo: {moduleId: 42})
   → Get dirId: "xyz789"

3. roxy_open_browser(workspaceId: 1, dirId: "xyz789")
   → Browser opens with proxy configured
```

### Example 3: Free Up Quota

```
1. roxy_list_browsers(workspaceId: 1)
   → See all browsers with dirIds

2. roxy_delete_browsers(workspaceId: 1, dirIds: ["old1", "old2"])
   → ✅ Quota freed (2 slots available)

⚠️ NOT: roxy_close_browsers (doesn't free quota!)
```

See `examples/basic-workflow.md` for 6 complete workflow examples.

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Error 409/101 | Quota exceeded | Use `roxy_delete_browsers`, not close |
| Error 401 | Invalid API key | Check `ROXY_API_KEY` env var |
| Error 404 | Resource not found | Verify IDs with list commands |
| Connection failed | App not running | Start RoxyBrowser, check port 50000 |

### Diagnostic Command

When facing issues, always start with:

```
roxy_system_diagnostics(verbose: true, includeWorkspaceCheck: true, includeBrowserCheck: true)
```

This provides:
- Connection status
- Authentication status
- Workspace access
- Specific recommendations

### Getting Help

1. Check `guides/common-errors.md` for detailed error reference
2. Run `roxy_system_diagnostics` for health check
3. Verify environment variables are set correctly
4. Ensure RoxyBrowser application is running

---

## Contributing

### Reporting Issues

1. Check existing issues first
2. Include error messages (both Chinese and English if applicable)
3. Provide steps to reproduce
4. Include `roxy_system_diagnostics` output

### Improving the Skill

1. Fork the repository
2. Make changes to skill files
3. Test with Claude Code
4. Submit pull request

### Guidelines

- Keep `skill.md` concise (target: <2500 tokens)
- Use tables and flowcharts over prose
- Include both Chinese and English error messages
- Test all workflow examples

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [RoxyBrowser](https://roxybrowser.com) - Anti-detect browser platform
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [Claude Code](https://claude.ai/code) - AI coding assistant
- [Agent Skills](https://agentskills.io) - Skill development standards

---

**Made for the RoxyBrowser community**
