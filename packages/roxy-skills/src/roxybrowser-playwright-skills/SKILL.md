---
name: roxybrowser-playwright-skills
description: Guides web automation using RoxyBrowser Playwright MCP tools. Use for navigation, clicking, typing, scraping, screenshots, or debugging via RoxyBrowser CDP endpoints.
---

# RoxyBrowser Playwright Automation Skill

Use this skill when the user needs to automate a live browser through the RoxyBrowser Playwright MCP tools.

## When to Use
- User wants to control a browser (navigate, click, type, upload, scrape)
- User needs element refs from an accessibility snapshot
- User needs debugging help for browser automation

## Quick Decision Matrix

| User intent | Tool | Notes |
| --- | --- | --- |
| Connect to RoxyBrowser | `browser_connect_roxy` | Requires CDP WebSocket endpoint |
| Navigate to a URL | `browser_navigate` | Follow with `browser_wait_for` |
| Find elements | `browser_snapshot` | Preferred over screenshot |
| Click an element | `browser_click` | Requires element `ref` |
| Type into a field | `browser_type` | `submit` optional |
| Wait for page change | `browser_wait_for` | Use `text` or `textGone` when possible |
| Run custom JS | `browser_evaluate` | For extraction or custom logic |
| Debug issues | `browser_console_messages` / `browser_network_requests` | Inspect failures |

## Critical Rules
- Always call `browser_snapshot` before interactions to get element identifiers (`ref` or `mcpId`).
- Know your snapshot mode: ARIA mode uses `ref` (string like "e48"), optimized mode uses `mcpId` (number like 42). Never mix them.
- `ref` values are temporary; re-snapshot after navigation or major DOM changes.
- Connect first: `browser_connect_roxy` is required before any automation.
- Wait after state changes (navigation, clicks, submits).
- Prefer read-only tools unless the user intends to change state.

## Starter Workflow
```
1. browser_connect_roxy(cdpEndpoint="ws://...")
2. browser_navigate(url="https://example.com")
3. browser_wait_for(time=2)
4. browser_snapshot()
```

## Progressive Disclosure (Load More Only When Needed)
- Tool catalog and parameters: `references/tool-catalog.md`
- Tool-selection guidance: `guides/tool-selection.md`
- Snapshot modes (ARIA vs Optimized): `guides/snapshot-modes.md`
- Waiting and timing patterns: `guides/waiting-and-timing.md`
- Error handling playbook: `guides/error-handling.md`
- Step-by-step workflows: `examples/*.md`

## Integration With RoxyBrowser OpenAPI
Use `roxybrowser-openapi-skills` to create/open a browser profile and obtain the CDP endpoint, then use this skill to automate it.
