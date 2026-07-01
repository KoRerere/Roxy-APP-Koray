# Common Errors Reference Guide

This guide reflects the current exported RoxyBrowser OpenAPI MCP tools.

## Fast Triage

| Problem | First action | Primary tool |
| --- | --- | --- |
| Cannot connect to RoxyBrowser API | Check server reachability and API setup | `roxy_health_check` |
| Browser quota exhausted | Delete old profiles | `roxy_delete_browsers` |
| Wrong workspace/browser/proxy/account ID | Re-discover IDs | list/detail tools |
| Proxy not working | Re-test proxy | `roxy_detect_proxy` |
| Browser payload rejected | Recheck required fields and enum values | `roxy_create_browser` / `roxy_update_browser` schema |

## Current Tool-Based Troubleshooting

### 1. Connectivity and authentication issues

Symptoms:
- MCP tool calls fail immediately
- API not reachable
- Key or local API setup looks wrong

Use:
- `roxy_health_check`

Check:
- RoxyBrowser desktop app is running
- API is enabled in RoxyBrowser
- `ROXY_API_KEY` is correct
- `ROXY_API_HOST` points to the correct local port

### 2. Quota issues

Symptoms:
- Create browser fails with quota-related message
- User believes closing browsers should free quota

Use:
1. `roxy_list_browsers`
2. `roxy_delete_browsers`

Important:
- `roxy_close_browsers` only closes processes.
- `roxy_delete_browsers` is the quota-releasing action.

### 3. Resource not found

Symptoms:
- Browser not found
- Workspace not found
- Proxy ID invalid
- Account ID invalid

Use:
- `roxy_list_workspaces`
- `roxy_list_browsers`
- `roxy_proxy_detail` or `roxy_list_proxies`
- `roxy_list_accounts`

### 4. Proxy problems

Symptoms:
- Browser created with proxy but cannot browse
- Detection status unavailable
- Proxy credentials or protocol may be wrong

Use:
1. `roxy_proxy_detail`
2. `roxy_detect_proxy`
3. `roxy_modify_proxy` if needed

Important:
- Only current exported proxy creation tool is `roxy_create_proxies`.
- Delete is only valid for deletable proxy entries, typically user-added ones.

### 5. Browser payload validation problems

Common causes:
- Missing `workspaceId`
- Missing `browserCore` on create
- Using invalid `os`
- Using invalid `browserCore`
- Firefox + macOS with `osVersion` not equal to `ALL`
- Sending both `proxyInfo.moduleId` and inline proxy fields
- Sending both account `id` and raw account credentials in the same `windowPlatformList` item

## High-Value Parameter Reminders

### `roxy_create_browser`

Required:
- `workspaceId`
- `browserCore`

Good minimal example:

```json
{
  "workspaceId": 1,
  "browserCore": "Chrome 149",
  "windowName": "Automation Browser"
}
```

### `roxy_open_browsers`

Required:
- `workspaceId`
- `dirIds`

Example:

```json
{
  "workspaceId": 1,
  "dirIds": ["abc123"]
}
```

### `roxy_create_proxies`

Required:
- `workspaceId`
- `proxyList`

Example:

```json
{
  "workspaceId": 1,
  "proxyList": [
    {
      "protocol": "SOCKS5",
      "host": "127.0.0.1",
      "port": "1080"
    }
  ]
}
```

## Legacy Advice To Ignore

If you see any older internal docs telling you to use these, ignore them:

- `roxy_open_browser`
- `roxy_system_diagnostics`
- `roxy_store_proxies`
- `roxy_validate_proxy_config`
- `roxy_get_detect_channels`

## Recovery Workflow

```text
Failure happens
|
|-- Connection/API issue? -> roxy_health_check
|-- Quota issue? -> roxy_list_browsers -> roxy_delete_browsers
|-- Browser ID issue? -> roxy_list_browsers / roxy_get_browser_detail
|-- Proxy issue? -> roxy_list_proxies -> roxy_proxy_detail -> roxy_detect_proxy
`-- Account binding issue? -> roxy_list_accounts
```
