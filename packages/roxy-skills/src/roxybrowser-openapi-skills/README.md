# RoxyBrowser OpenAPI Skills

This skill package helps an agent use the current RoxyBrowser OpenAPI MCP server correctly, with less context and fewer wrong tool calls.

It is written for real usage scenarios, so the guidance focuses on the exported MCP tools and their user-facing workflows rather than any local development path.

## What It Covers

- Workspace discovery with `roxy_list_workspaces`
- Browser profile lifecycle with `roxy_list_browsers`, `roxy_create_browser`, `roxy_batch_create_browsers`, `roxy_open_browsers`, `roxy_update_browser`, `roxy_close_browsers`, `roxy_delete_browsers`
- Browser inspection and maintenance with `roxy_get_browser_detail`, `roxy_get_connection_info`, `roxy_random_fingerprint`, `roxy_clear_local_cache`, `roxy_clear_server_cache`, `roxy_list_labels`
- Proxy management with `roxy_list_proxies`, `roxy_proxy_detail`, `roxy_create_proxies`, `roxy_detect_proxy`, `roxy_modify_proxy`, `roxy_delete_proxies`
- Account management with `roxy_list_accounts`, `roxy_create_account`, `roxy_batch_create_accounts`, `roxy_modify_account`, `roxy_delete_accounts`
- Basic connectivity checks with `roxy_health_check`

## Important Current Naming

- `roxy_open_browsers` is the current open tool.
- `roxy_health_check` is the current health tool.
- `roxy_create_proxies` is the current proxy creation tool.
- `roxy_proxy_detail` is the current proxy detail tool.

These older names should not be used:

- `roxy_open_browser`
- `roxy_system_diagnostics`
- `roxy_create_proxy`
- `roxy_batch_create_proxies`
- `roxy_store_proxies`
- `roxy_validate_proxy_config`
- `roxy_get_detect_channels`

## File Structure

```text
roxybrowser-openapi-skills/
├── SKILL.md
├── README.md
├── guides/
│   ├── tool-selection.md
│   └── common-errors.md
└── examples/
    └── basic-workflow.md
```

## Recommended Read Order

1. `SKILL.md`
2. `guides/tool-selection.md`
3. `guides/common-errors.md`
4. `examples/basic-workflow.md`

## Fast Usage Notes

### Create and automate a browser

1. `roxy_list_workspaces`
2. `roxy_create_browser`
3. `roxy_open_browsers`
4. automate with returned `ws`
5. `roxy_close_browsers`

### Free browser quota

1. `roxy_list_browsers`
2. `roxy_delete_browsers`

Important:
- `roxy_close_browsers` does not free quota.

### Bind a proxy

1. `roxy_list_proxies` or `roxy_create_proxies`
2. bind with `proxyInfo.moduleId`
3. `roxy_create_browser` or `roxy_update_browser`

### Reuse a stored platform account

1. `roxy_list_accounts`
2. use `windowPlatformList: [{ id }]`

## High-Value Parameter Rules

- `roxy_create_browser` requires `workspaceId` and `browserCore`.
- `roxy_open_browsers` requires `workspaceId` and `dirIds`.
- `roxy_delete_browsers` requires `workspaceId` and `dirIds`.
- `roxy_create_proxies` requires `workspaceId` and `proxyList`.
- If `proxyInfo.moduleId` is present, do not also send inline proxy host/port fields.
- If `windowPlatformList[].id` is present, do not also send raw credentials for that same item.
- Firefox on `macOS` only supports `osVersion: "ALL"`.

## Goal

The goal of this skill is straightforward:
- help the agent pick the right current MCP tool
- prevent legacy-name drift
- keep common browser/proxy/account workflows reliable
