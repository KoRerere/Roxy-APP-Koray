---
name: roxybrowser-openapi-skills
description: Guides tool selection and usage for RoxyBrowser MCP Server browser automation. Use when working with RoxyBrowser, anti-detect browsers, fingerprint browsers, CDP endpoints, browser profiles, or proxy-enabled automation.
---

# RoxyBrowser OpenAPI Skill

> Provides efficient tool selection guidance for Claude when using RoxyBrowser MCP tools, reducing token consumption and improving tool selection accuracy.

---

## Quick Decision Matrix

Use this table to quickly identify which tool to call based on user intent:

| User Intent                | Recommended Tool                                               | When to Use                                                         |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Create new browser profile | `roxy_create_browser`                                          | User wants to set up a new browser with custom configuration        |
| Open existing browser      | `roxy_open_browser`                                            | User has a browser ID (dirId) and wants to start automation         |
| List available browsers    | `roxy_list_workspaces` or `roxy_list_browsers`                 | User needs to see what browsers/workspaces exist                    |
| Close running browser      | `roxy_close_browsers`                                          | Browser is open and needs to be closed (doesn't free quota)         |
| Delete browser permanently | `roxy_delete_browsers`                                         | Free up quota by removing browser profiles                          |
| Configure proxy            | `roxy_list_proxies`, `roxy_store_proxies`, `roxy_create_proxy` | User needs to set up or manage proxy configurations                 |
| Get CDP endpoint           | `roxy_open_browser`                                            | User needs WebSocket URL for Playwright/Puppeteer                   |
| Troubleshoot issues        | `roxy_system_diagnostics`                                      | Connection problems, authentication errors, or general health check |
| Manage platform accounts   | `roxy_list_accounts`, `roxy_create_account`                    | User needs to store/retrieve login credentials                      |
| Update browser config      | `roxy_update_browser`                                          | Modify existing browser settings without recreating                 |

---

## Tool Categories

### Workspace & Discovery

- `roxy_list_workspaces` - Get all workspaces and projects (use this FIRST if user doesn't know workspace ID)
- `roxy_list_browsers` - List browsers in a workspace (requires workspaceId)
- `roxy_list_accounts` - View stored platform credentials
- `roxy_list_labels` - Get browser organization tags
- `roxy_list_proxies` - List proxies from RoxyBrowser configuration
- `roxy_store_proxies` - List proxies from RoxyBrowser's store

### Browser Lifecycle

- `roxy_create_browser` - Create new browser (returns dirId for opening)
- `roxy_open_browser` - Open browser & get CDP endpoint (requires dirId)
- `roxy_close_browsers` - Close running browsers (does NOT free quota)
- `roxy_delete_browsers` - Permanently delete browsers (DOES free quota)
- `roxy_get_connection_info` - Get CDP endpoints for already-opened browsers

### Browser Configuration

- `roxy_update_browser` - Modify existing browser settings
- `roxy_random_fingerprint` - Randomize browser fingerprint
- `roxy_clear_local_cache` - Clear local browser cache
- `roxy_clear_server_cache` - Clear server-side cache

### Proxy Management

- `roxy_create_proxy` - Add new proxy configuration
- `roxy_batch_create_proxies` - Add multiple proxies at once
- `roxy_detect_proxy` - Test proxy and update IP info
- `roxy_modify_proxy` - Update existing proxy settings
- `roxy_delete_proxies` - Remove proxy configurations

### Account Management

- `roxy_create_account` - Store platform credentials
- `roxy_batch_create_accounts` - Store multiple accounts
- `roxy_modify_account` - Update account credentials
- `roxy_delete_accounts` - Remove stored accounts

### Diagnostics

- `roxy_system_diagnostics` - Comprehensive health check (use when troubleshooting)
- `roxy_validate_proxy_config` - Verify proxy settings before use
- `roxy_get_detect_channels` - Get available IP detection services

---

## Common Scenarios & Workflows

### Scenario 1: First-Time User Automation

```
User says: "I want to automate a browser task"

Decision Path:
1. Call `roxy_list_workspaces` -> Get workspace ID
2. Call `roxy_create_browser` with workspaceId -> Get dirId
3. Call `roxy_open_browser` with dirId -> Get CDP WebSocket URL
4. Use CDP endpoint for automation (outside MCP - user will handle)
5. Call `roxy_close_browsers` when done
```

### Scenario 2: User Has Quota Issues

```
User says: "I'm getting quota errors" or mentions error code 409/101

Decision Path:
1. Explain: Closing browsers doesn't free quota, must DELETE
2. Call `roxy_list_browsers` to show user's browsers
3. Ask which to delete
4. Call `roxy_delete_browsers` with selected dirIds
```

### Scenario 3: Proxy Configuration

```
User says: "I need to use a proxy" or "Set up SOCKS5 proxy"

Decision Path:
1. If user has proxy in RoxyBrowser: Call `roxy_list_proxies` or `roxy_store_proxies`, get moduleId
2. If creating new proxy: Call `roxy_create_proxy` with proxy details
3. When creating browser: Pass proxyInfo.moduleId or full proxy config to `roxy_create_browser`
```

### Scenario 4: Troubleshooting

```
User says: "It's not working" or "Connection failed"

Decision Path:
1. Call `roxy_system_diagnostics` (verbose: true for details)
2. Check diagnostics results:
   - Connection failed? -> Check ROXY_API_HOST and RoxyBrowser app running
   - Auth failed? -> Check ROXY_API_KEY environment variable
   - Workspace access? -> Verify workspace exists
3. Provide specific recommendations from diagnostics output
```

---

## Critical Rules

### QUOTA MANAGEMENT

- **IMPORTANT**: `roxy_close_browsers` does NOT free quota
- **ALWAYS** use `roxy_delete_browsers` to free up browser profile quota
- Error codes 409 or 101 = insufficient quota -> must DELETE browsers, not just close

### Required Parameters

- Almost all tools require `workspaceId` - get it from `roxy_list_workspaces` if user doesn't provide
- Browser operations need `dirId` - get it from `roxy_create_browser` or `roxy_list_browsers`
- Proxy binding: Use `moduleId` (from `roxy_list_proxies`/`roxy_store_proxies`) OR full proxy config (not both)

### Workflow Best Practices

1. **Start with discovery**: Call `roxy_list_workspaces` if workspace ID unknown
2. **Reuse before recreate**: Check existing browsers with `roxy_list_browsers` before creating new ones
3. **Get CDP endpoint**: `roxy_open_browser` returns the WebSocket URL needed for Playwright/Puppeteer
4. **Clean up properly**: Delete unused browsers to free quota

### Tool Parameter Binding

- **Proxy**: If `proxyInfo.moduleId` is provided, DO NOT pass other proxy fields (host, port, etc.)
- **Platform Account**: If `windowPlatformList[].id` is provided, DO NOT pass credentials (platformUserName, platformPassword)
- **Browser Creation**: `roxy_create_browser` is the COMPLETE tool - use it instead of deprecated simple/standard/advanced variants

---

## Error Prevention Guide

### Common Error Codes

- **401**: Authentication failed -> Check `ROXY_API_KEY` environment variable
- **409/101**: Insufficient quota -> Use `roxy_delete_browsers`, not `roxy_close_browsers`
- **404**: Resource not found -> Verify workspaceId/dirId exists with list commands
- **500**: Server error -> Call `roxy_system_diagnostics` for health check

### Before Tool Calls

- Verify workspace exists before creating browsers
- Check if browser is already open before calling `roxy_open_browser` (use `roxy_get_connection_info`)
- Validate proxy config with `roxy_validate_proxy_config` before creating browsers with proxies
- Use `roxy_system_diagnostics` if any connection issues suspected

---

## Token Optimization Tips

1. **Use this skill**: Load this skill instead of full MCP tool documentation (saves 60%+ tokens)
2. **Decision matrix first**: Check the Quick Decision Matrix above before reading full tool docs
3. **Progressive disclosure**: Only read detailed guides (see `/guides/` and `/examples/`) when needed
4. **Batch operations**: Use batch tools (`roxy_batch_create_proxies`, `roxy_batch_create_accounts`) when creating multiple items

---

## Additional Resources

For detailed information, see:

- `guides/tool-selection.md` - Flowchart-style decision tree
- `guides/common-errors.md` - Comprehensive error reference table
- `guides/best-practices.md` - Advanced usage patterns
- `examples/basic-workflow.md` - Step-by-step basic automation
- `examples/advanced-usage.md` - Proxy config, multi-browser management
- `examples/error-handling.md` - Quota and retry strategies

---

## Quick Start for Common Tasks

### Task: Create and automate a browser

```
1. roxy_list_workspaces -> get workspaceId
2. roxy_create_browser(workspaceId, windowName) -> get dirId
3. roxy_open_browser(workspaceId, dirId) -> get ws (CDP endpoint)
4. Use ws with Playwright/Puppeteer
5. roxy_close_browsers([dirId])
```

### Task: Set up browser with proxy

```
1. roxy_list_proxies(workspaceId) -> get proxy moduleId
   OR roxy_create_proxy(workspaceId, protocol, host, port) -> get new proxy
2. roxy_create_browser(workspaceId, proxyInfo: {moduleId: X})
3. roxy_open_browser(workspaceId, dirId)
```

### Task: Free up quota

```
1. roxy_list_browsers(workspaceId) -> see all browsers
2. roxy_delete_browsers(workspaceId, [dirId1, dirId2, ...])
   WARNING: NOT roxy_close_browsers - closing doesn't free quota!
```
