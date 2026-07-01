---
name: roxybrowser-playwright-skills
description: Guides web automation using RoxyBrowser Playwright MCP tools. Use for navigation, clicking, typing, scraping, screenshots, or debugging through RoxyBrowser browser connection endpoints.
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
| Connect to RoxyBrowser | `roxy_browser_connect` | Requires a browser WebSocket endpoint and supports Chrome or Firefox |
| Navigate to a URL | `browser_navigate` | For initial entry, user-given URLs, or when clicking a link doesn't navigate. For in-page navigation, prefer clicking the link first — see `guides/human-like-interaction.md` |
| Find elements | `browser_snapshot` | Preferred over screenshot |
| Click an element | `browser_click` | Requires element `ref` |
| Type into a field | `browser_type` | `submit` optional |
| Wait for page change | `browser_wait_for` | Use `text` or `textGone` when possible |
| Run custom JS | `browser_evaluate` | For reading data; also a fallback to change state when the UI control doesn't work |
| Debug issues | `browser_console_messages` / `browser_network_requests` | Inspect failures |

## Critical Rules
- Always call `browser_snapshot` before interactions to get element identifiers (`ref` or `mcpId`).
- Know your snapshot mode: ARIA mode uses `ref` (string like "e48"), optimized mode uses `mcpId` (number like 42). Never mix them.
- `ref` values are temporary; re-snapshot after navigation or major DOM changes.
- Connect first: `roxy_browser_connect` is required before any automation.
- `roxy_browser_connect` uses `endpoint`, not `cdpEndpoint`.
- `roxy_browser_connect` supports `browserCore: "Chrome"` and `browserCore: "Firefox"`.
- For Chrome, use a CDP WebSocket URL like `ws://127.0.0.1:PORT/devtools/browser/...`.
- For Firefox, use a BiDi WebSocket endpoint.
- Wait after state changes (navigation, clicks, submits).
- Prefer read-only tools unless the user intends to change state.
- **Prefer human-like operation.** By default, when the page offers a control (link, button, tab, pagination) that leads to the next step, click it and let the browser transition — like a real user. Only fall back to mechanical shortcuts (extracting the `href` and calling `browser_navigate`, or using `browser_evaluate` to change state) when the click doesn't actually work or no usable control exists. See `guides/human-like-interaction.md`.

## Starter Workflow
``` 
1. roxy_browser_connect(endpoint="ws://...", browserCore="Chrome")
2. browser_navigate(url="https://example.com")
3. browser_wait_for(time=2)
4. browser_snapshot()
```

Use this shape instead:

```json
{
  "endpoint": "ws://127.0.0.1:PORT/devtools/browser/...",
  "browserCore": "Chrome"
}
```

Or for Firefox:

```json
{
  "endpoint": "ws://127.0.0.1:PORT/session",
  "browserCore": "Firefox"
}
```

## Progressive Disclosure (Load More Only When Needed)
- Tool catalog and parameters: `references/tool-catalog.md`
- Tool-selection guidance: `guides/tool-selection.md`
- Snapshot modes (ARIA vs Optimized): `guides/snapshot-modes.md`
- Waiting and timing patterns: `guides/waiting-and-timing.md`
- Human-like interaction (click links instead of navigating URLs, prefer UI controls over JS): `guides/human-like-interaction.md`
- Error handling playbook: `guides/error-handling.md`
- Step-by-step workflows: `examples/*.md`

## Integration With RoxyBrowser OpenAPI
Use `roxybrowser-openapi-skills` to create/open a browser profile and obtain the browser WebSocket endpoint, then use this skill to automate it.
