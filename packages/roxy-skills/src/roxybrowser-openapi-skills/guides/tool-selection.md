# Tool Selection Decision Tree

Use this guide with the current RoxyBrowser OpenAPI MCP server.

## Primary Flow

```text
START
|
|-- Need workspace IDs?
|    `-- roxy_list_workspaces
|
|-- Need browser profiles?
|    |-- List/filter -> roxy_list_browsers
|    |-- Detail for one profile -> roxy_get_browser_detail
|    |-- Create one -> roxy_create_browser
|    |-- Create many -> roxy_batch_create_browsers
|    |-- Update -> roxy_update_browser
|    |-- Open and get CDP endpoint -> roxy_open_browsers
|    |-- Get live endpoints for already-open browsers -> roxy_get_connection_info
|    |-- Close only -> roxy_close_browsers
|    `-- Delete permanently -> roxy_delete_browsers
|
|-- Need proxy operations?
|    |-- List -> roxy_list_proxies
|    |-- Detail -> roxy_proxy_detail
|    |-- Create -> roxy_create_proxies
|    |-- Detect/test -> roxy_detect_proxy
|    |-- Modify -> roxy_modify_proxy
|    `-- Delete -> roxy_delete_proxies
|
|-- Need account operations?
|    |-- List -> roxy_list_accounts
|    |-- Create one -> roxy_create_account
|    |-- Create many -> roxy_batch_create_accounts
|    |-- Modify -> roxy_modify_account
|    `-- Delete -> roxy_delete_accounts
|
|-- Need browser extras?
|    |-- Labels -> roxy_list_labels
|    |-- Randomize fingerprint -> roxy_random_fingerprint
|    |-- Clear local cache -> roxy_clear_local_cache
|    `-- Clear server cache -> roxy_clear_server_cache
|
`-- Need connectivity check?
     `-- roxy_health_check
```

## Common Decision Paths

### User says "open a browser"

1. If `workspaceId` unknown -> `roxy_list_workspaces`
2. If `dirId` unknown -> `roxy_list_browsers`
3. Open -> `roxy_open_browsers`

Note:
- The current tool name is `roxy_open_browsers`.
- It expects `dirIds: []`, even when opening only one browser.

### User says "I need a CDP endpoint"

1. If browser is not open yet -> `roxy_open_browsers`
2. If browser may already be open -> `roxy_get_connection_info`

### User says "set up proxy for a browser"

1. Existing proxy unknown -> `roxy_list_proxies`
2. Need proxy details -> `roxy_proxy_detail`
3. Need to create proxy -> `roxy_create_proxies`
4. Need to test proxy -> `roxy_detect_proxy`
5. Bind by `proxyInfo.moduleId` in `roxy_create_browser` or `roxy_update_browser`

### User says "I hit quota limit"

1. `roxy_list_browsers`
2. `roxy_delete_browsers`

Do not use `roxy_close_browsers` for quota recovery.

### User says "browser settings need changing"

1. `roxy_get_browser_detail`
2. `roxy_update_browser`
3. If needed, `roxy_random_fingerprint`

### User says "credentials/account needs to be reused"

1. `roxy_list_accounts`
2. Use returned `id` inside `windowPlatformList`

## ID Resolution

### Need `workspaceId`

Use `roxy_list_workspaces`.

### Need `dirId`

Use one of:
- `roxy_list_browsers`
- result from `roxy_create_browser`

### Need proxy `id`

Use one of:
- `roxy_list_proxies`
- `roxy_proxy_detail`

### Need account `id`

Use `roxy_list_accounts`.

## Legacy Names To Avoid

- `roxy_open_browser`
- `roxy_system_diagnostics`
- `roxy_create_proxy`
- `roxy_batch_create_proxies`
- `roxy_store_proxies`
- `roxy_validate_proxy_config`
