# Basic Workflow Examples

Examples here use the current MCP tool names and parameter shapes.

## Example 1: First Browser Automation

### Step 1: Find the workspace

```text
Call: roxy_list_workspaces
```

Pick the target `workspaceId`.

### Step 2: Create a browser

```json
{
  "workspaceId": 1,
  "browserCore": "Chrome 149",
  "windowName": "My Automation Browser"
}
```

Call:

```text
roxy_create_browser
```

Save the returned `dirId`.

### Step 3: Open the browser and get CDP info

```json
{
  "workspaceId": 1,
  "dirIds": ["abc123def456"]
}
```

Call:

```text
roxy_open_browsers
```

Expected useful fields:
- `ws`
- `http`
- `pid`

### Step 4: Automate through Playwright/Puppeteer

Use the returned `ws` endpoint with your browser automation client.

### Step 5: Close when done

```json
{
  "dirIds": ["abc123def456"]
}
```

Call:

```text
roxy_close_browsers
```

Note:
- This closes the running browser process.
- It does not free quota.

## Example 2: Reuse an Existing Browser

1. `roxy_list_browsers`
2. Pick a `dirId`
3. `roxy_open_browsers`
4. Use returned `ws`
5. `roxy_close_browsers`

Example list request:

```json
{
  "workspaceId": 1,
  "pageSize": 10
}
```

## Example 3: Get Endpoint for an Already Open Browser

If the browser may already be open, use:

```text
roxy_get_connection_info
```

Optional filter:

```json
{
  "dirIds": ["abc123def456"]
}
```

## Example 4: Free Browser Quota

1. `roxy_list_browsers`
2. Choose unused `dirIds`
3. `roxy_delete_browsers`

Delete request:

```json
{
  "workspaceId": 1,
  "dirIds": ["abc123def456", "ghi789jkl012"]
}
```

Important:
- Use delete, not close, when the goal is quota recovery.

## Example 5: Create and Bind a Proxy

Create proxy:

```json
{
  "workspaceId": 1,
  "proxyList": [
    {
      "protocol": "SOCKS5",
      "host": "1.2.3.4",
      "port": "1080",
      "proxyUserName": "user",
      "proxyPassword": "pass",
      "remark": "residential socks5"
    }
  ]
}
```

Call:

```text
roxy_create_proxies
```

Then list proxies:

```text
roxy_list_proxies
```

Use the returned proxy `id` as `proxyInfo.moduleId` when creating or updating a browser.

Browser example:

```json
{
  "workspaceId": 1,
  "browserCore": "Chrome 149",
  "windowName": "Proxy Browser",
  "proxyInfo": {
    "moduleId": 88
  }
}
```

## Example 6: Reuse a Stored Platform Account

1. `roxy_list_accounts`
2. Pick account `id`
3. Create or update browser with `windowPlatformList`

Example:

```json
{
  "workspaceId": 1,
  "browserCore": "Chrome 149",
  "windowName": "Account Browser",
  "windowPlatformList": [
    {
      "id": 123
    }
  ]
}
```

## Example 7: Troubleshoot Connectivity

Use:

```text
roxy_health_check
```

This is the current exported connectivity check tool.
