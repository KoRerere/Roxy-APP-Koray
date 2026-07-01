---
name: roxybrowser-openapi-skills
description: Guides tool selection and usage for the current RoxyBrowser OpenAPI MCP tools. Use when working with RoxyBrowser workspaces, browser profiles, CDP endpoints, proxy configs, platform accounts, browser fingerprints, or cache cleanup.
---

# RoxyBrowser OpenAPI Skill

This skill is aligned to the current RoxyBrowser OpenAPI MCP tool set and is intended for real user-facing automation workflows.

## Current Tool Map

| User intent | Use this tool | Notes |
| --- | --- | --- |
| Find workspace IDs | `roxy_list_workspaces` | Start here if `workspaceId` is unknown |
| List browser profiles | `roxy_list_browsers` | Supports common browser lookup fields like `windowName` and `windowSortNum` |
| Create one browser | `roxy_create_browser` | Full config tool |
| Create many browsers | `roxy_batch_create_browsers` | Pass `browsers: []` |
| Open browser(s) and get CDP endpoint(s) | `roxy_open_browsers` | Returns `ws`, `http`, `pid` |
| Inspect one browser in detail | `roxy_get_browser_detail` | Good before update/delete |
| Update browser config | `roxy_update_browser` | Requires `workspaceId` and `dirId` |
| Close browser(s) | `roxy_close_browsers` | Does not free quota |
| Delete browser(s) permanently | `roxy_delete_browsers` | Frees quota |
| Get currently opened browser endpoints | `roxy_get_connection_info` | `dirIds` optional |
| Randomize fingerprint | `roxy_random_fingerprint` | Restart browser to apply |
| Clear local cache | `roxy_clear_local_cache` | Only needs `dirIds` |
| Clear server cache | `roxy_clear_server_cache` | Needs `workspaceId` and `dirIds` |
| List labels | `roxy_list_labels` | Use for `labelIds` in browser creation |
| List proxies | `roxy_list_proxies` | Merged list of user-added and store proxies |
| Inspect one proxy | `roxy_proxy_detail` | Use before modify/delete/bind |
| Create proxies | `roxy_create_proxies` | Batch create via `proxyList` |
| Detect/test proxy | `roxy_detect_proxy` | Needs proxy `id` |
| Modify proxy | `roxy_modify_proxy` | Needs `workspaceId` and proxy `id` |
| Delete proxies | `roxy_delete_proxies` | Only user-added proxies are deletable |
| List accounts | `roxy_list_accounts` | Returns platform account IDs |
| Create account | `roxy_create_account` | Single account |
| Batch create accounts | `roxy_batch_create_accounts` | Pass `accountList: []` |
| Modify account | `roxy_modify_account` | Needs `workspaceId` and account `id` |
| Delete accounts | `roxy_delete_accounts` | Permanent |
| Check server health | `roxy_health_check` | Use for connectivity/API availability |

## Recommended Workflows

### 1. Create a browser and automate it

1. `roxy_list_workspaces` -> get `workspaceId`
2. `roxy_create_browser` -> get `dirId`
3. `roxy_open_browsers` with `dirIds: [dirId]` -> get `ws`
4. Use the returned CDP endpoint in Playwright
5. `roxy_close_browsers` when done

### 2. Reuse an existing browser

1. `roxy_list_browsers`
2. `roxy_open_browsers`
3. `roxy_get_connection_info` if you only need the live endpoint list

### 3. Free browser quota

1. `roxy_list_browsers`
2. `roxy_delete_browsers`

Critical rule:
- `roxy_close_browsers` does not free quota.
- `roxy_delete_browsers` does free quota.

### 4. Bind a proxy to a browser

1. `roxy_list_proxies` or `roxy_create_proxies`
2. Prefer binding with `proxyInfo.moduleId`
3. `roxy_create_browser` or `roxy_update_browser`

### 5. Bind a stored platform account

1. `roxy_list_accounts`
2. Use `windowPlatformList: [{ id: accountId }]` in `roxy_create_browser` or `roxy_update_browser`

## Parameter Rules That Matter

### Browser creation and update

- `roxy_create_browser` currently requires `workspaceId` and `browserCore`.
- Valid `browserCore` values are controlled by the MCP server. Examples currently include `Chrome 149` and `Firefox 146`.
- Valid `os` values are `Windows`, `macOS`, `Linux`, `IOS`, `Android`.
- If `browserCore` is Firefox and `os` is `macOS`, then `osVersion` must be `ALL`.
- `useLatestCore` is numeric: `1` or `0`, not boolean.

### Opening browsers

- `roxy_open_browsers` requires `workspaceId` and `dirIds`.
- It supports opening multiple browsers in one call.
- `forceOpen` defaults to `true`.

### Proxy binding

- If `proxyInfo.moduleId` is provided, do not pass `host`, `port`, or other inline proxy fields.
- `moduleId` comes from `roxy_list_proxies` result field `id`.

### Platform account binding

- If `windowPlatformList[].id` is provided, do not also send `platformUserName` / `platformPassword` for that same entry.

## When To Use Which Discovery Tool

- Unknown workspace: `roxy_list_workspaces`
- Unknown browser profile: `roxy_list_browsers`
- Need live CDP endpoints only: `roxy_get_connection_info`
- Need browser config details before modification: `roxy_get_browser_detail`
- Need proxy metadata before binding/modifying: `roxy_proxy_detail`

## Error Handling Shortcuts

- Auth/connectivity problem: `roxy_health_check`
- Quota issue: `roxy_delete_browsers`
- Wrong `workspaceId` / `dirId` / proxy `id` / account `id`: use the corresponding list/detail tool again
- Proxy unavailable: `roxy_detect_proxy`

## What This Skill Optimizes For

1. Prefer discovery before mutation.
2. Prefer reusing existing resources before creating new ones.
3. Prefer current exported tool names over legacy names in older docs.
4. Keep browser creation payloads minimal unless the user explicitly needs advanced fingerprint or proxy settings.

## Additional Files

- `guides/tool-selection.md` - decision flow by task
- `guides/common-errors.md` - current error handling guidance
- `examples/basic-workflow.md` - updated end-to-end examples
