# Basic Workflow Examples

Step-by-step guides for common RoxyBrowser automation scenarios.

## Contents
- [Example 1: First Browser Automation](#example-1-first-browser-automation-no-prior-setup)
- [Example 2: Reuse Existing Browser](#example-2-reuse-existing-browser)
- [Example 3: Check Running Browsers](#example-3-check-running-browsers)
- [Example 4: Complete Cleanup (Free Quota)](#example-4-complete-cleanup-free-quota)
- [Example 5: Quick Diagnostic Check](#example-5-quick-diagnostic-check)
- [Example 6: Browser Detail Inspection](#example-6-browser-detail-inspection)
- [Workflow Comparison Table](#workflow-comparison-table)
- [Best Practices Summary](#best-practices-summary)

---

## Example 1: First Browser Automation (No Prior Setup)

**Scenario**: User wants to automate a browser task but has never used RoxyBrowser MCP before.

### Progress Checklist

Copy this checklist and track your progress:

```
Task Progress:
- [ ] Step 1: Get workspace ID (roxy_list_workspaces)
- [ ] Step 2: Create browser (roxy_create_browser)
- [ ] Step 3: Verify creation (check dirId returned)
- [ ] Step 4: Open browser (roxy_open_browser)
- [ ] Step 5: Verify CDP endpoint (check ws URL)
- [ ] Step 6: Close browser when done (roxy_close_browsers)
```

### Steps:

#### Step 1: Discover Workspaces
```
Call: roxy_list_workspaces

Response:
{
  "total": 2,
  "rows": [
    {
      "id": 1,
      "workspaceName": "Default Workspace",
      "project_details": [
        {"projectId": 10, "projectName": "Main Project"}
      ]
    }
  ]
}

Action: Select workspace ID → 1
```

#### Step 2: Create Browser
```
Call: roxy_create_browser
Parameters:
{
  "workspaceId": 1,
  "windowName": "My Automation Browser",
  "os": "Windows"
}

Response:
{
  "code": 0,
  "data": {
    "dirId": "abc123def456"
  }
}

Action: Save dirId → "abc123def456"
```

#### Step 3: Open Browser
```
Call: roxy_open_browser
Parameters:
{
  "workspaceId": 1,
  "dirId": "abc123def456"
}

Response:
{
  "code": 0,
  "data": {
    "ws": "ws://127.0.0.1:52314/devtools/browser/abc123def456",
    "http": "http://127.0.0.1:52314",
    "pid": 12345,
    "coreVersion": "143"
  }
}

Action: Extract CDP WebSocket URL → "ws://127.0.0.1:52314/devtools/browser/abc123def456"
```

#### Step 4: Automation (User Handles This)
User now uses the CDP WebSocket URL with Playwright, Puppeteer, or other automation tools.

```javascript
// Example with Playwright (user's code, not MCP)
const browser = await playwright.chromium.connectOverCDP(
  "ws://127.0.0.1:52314/devtools/browser/abc123def456"
);
```

#### Step 5: Close Browser
```
Call: roxy_close_browsers
Parameters:
{
  "dirIds": ["abc123def456"]
}

Response:
{
  "code": 0,
  "message": "Successfully closed 1 browsers"
}

Note: Browser is closed but profile still exists (quota still used)
```

### Complete Workflow Summary:
```
roxy_list_workspaces
  → Get workspaceId: 1

roxy_create_browser(workspaceId: 1, windowName: "...")
  → Get dirId: "abc123def456"

roxy_open_browser(workspaceId: 1, dirId: "abc123def456")
  → Get CDP URL: "ws://127.0.0.1:52314/..."

[User automation with CDP endpoint]

roxy_close_browsers(dirIds: ["abc123def456"])
  → ✅ Browser closed
```

**Time**: ~30 seconds
**API Calls**: 4 MCP tools
**Result**: Browser ready for automation with CDP endpoint

---

## Example 2: Reuse Existing Browser

**Scenario**: User has already created browsers and wants to open an existing one.

### Steps:

#### Step 1: List Existing Browsers
```
Call: roxy_list_browsers
Parameters:
{
  "workspaceId": 1,
  "pageSize": 10
}

Response:
{
  "total": 3,
  "rows": [
    {
      "dirId": "browser001",
      "windowName": "Gmail Automation",
      "os": "Windows",
      "status": "closed"
    },
    {
      "dirId": "browser002",
      "windowName": "LinkedIn Bot",
      "os": "macOS",
      "status": "closed"
    }
  ]
}

Action: User selects → dirId: "browser001"
```

#### Step 2: Open Existing Browser
```
Call: roxy_open_browser
Parameters:
{
  "workspaceId": 1,
  "dirId": "browser001"
}

Response:
{
  "code": 0,
  "data": {
    "ws": "ws://127.0.0.1:52314/devtools/browser/browser001",
    "pid": 67890
  }
}
```

#### Step 3: Automation
User uses CDP endpoint for automation (browser retains cookies, history, etc. from previous sessions).

#### Step 4: Close When Done
```
Call: roxy_close_browsers
Parameters:
{
  "dirIds": ["browser001"]
}
```

### Complete Workflow Summary:
```
roxy_list_browsers(workspaceId: 1)
  → Select existing dirId: "browser001"

roxy_open_browser(workspaceId: 1, dirId: "browser001")
  → Get CDP URL

[User automation]

roxy_close_browsers(dirIds: ["browser001"])
```

**Time**: ~10 seconds
**API Calls**: 3 MCP tools
**Benefit**: Reuses existing profile (cookies, login state preserved)

---

## Example 3: Check Running Browsers

**Scenario**: User wants to see which browsers are currently open and get their CDP endpoints.

### Steps:

#### Step 1: Get Connection Info
```
Call: roxy_get_connection_info
Parameters:
{
  // No dirIds = get all opened browsers
}

Response:
{
  "code": 0,
  "data": [
    {
      "dirId": "browser001",
      "windowName": "Gmail Automation",
      "ws": "ws://127.0.0.1:52314/devtools/browser/browser001",
      "http": "http://127.0.0.1:52314",
      "pid": 12345,
      "coreVersion": "143"
    },
    {
      "dirId": "browser003",
      "windowName": "Test Browser",
      "ws": "ws://127.0.0.1:52315/devtools/browser/browser003",
      "http": "http://127.0.0.1:52315",
      "pid": 12346,
      "coreVersion": "143"
    }
  ]
}

Action: Use existing CDP endpoints for automation
```

### Use Case:
- Reconnect to already-open browsers
- Monitor running automation tasks
- Get CDP endpoints without reopening

**Time**: ~2 seconds
**API Calls**: 1 MCP tool

---

## Example 4: Complete Cleanup (Free Quota)

**Scenario**: User is done with browsers and wants to free up quota for new profiles.

### Steps:

#### Step 1: List Browsers
```
Call: roxy_list_browsers
Parameters:
{
  "workspaceId": 1
}

Response:
{
  "total": 5,
  "rows": [
    {"dirId": "browser001", "windowName": "Old Test 1", "status": "closed"},
    {"dirId": "browser002", "windowName": "Old Test 2", "status": "closed"},
    {"dirId": "browser003", "windowName": "Keep This", "status": "closed"}
  ]
}
```

#### Step 2: Close Any Open Browsers First
```
Call: roxy_close_browsers
Parameters:
{
  "dirIds": ["browser001", "browser002"]
}

Note: Only needed if browsers are currently open
```

#### Step 3: Delete Browsers Permanently
```
Call: roxy_delete_browsers
Parameters:
{
  "workspaceId": 1,
  "dirIds": ["browser001", "browser002"]
}

Response:
{
  "code": 0,
  "message": "Successfully deleted 2 browser(s)"
}

Result: ✅ Quota freed! Can now create 2 new browser profiles
```

### ⚠️ CRITICAL WARNING:
- **Closing** browsers (`roxy_close_browsers`) does NOT free quota
- **Deleting** browsers (`roxy_delete_browsers`) DOES free quota
- Deletion is permanent - all data (cookies, history, cache) is lost

### Complete Workflow Summary:
```
roxy_list_browsers(workspaceId: 1)
  → Identify unused browsers

roxy_close_browsers(dirIds: [...])  // Optional: if browsers are open

roxy_delete_browsers(workspaceId: 1, dirIds: ["browser001", "browser002"])
  → ✅ Quota freed
```

**Time**: ~15 seconds
**API Calls**: 2-3 MCP tools
**Result**: Browser profiles permanently deleted, quota available for new browsers

---

## Example 5: Quick Diagnostic Check

**Scenario**: User is experiencing issues and wants to verify system health.

### Steps:

#### Step 1: Run Diagnostics
```
Call: roxy_system_diagnostics
Parameters:
{
  "verbose": true,
  "includeWorkspaceCheck": true,
  "includeBrowserCheck": true
}

Response:
{
  "connected": true,
  "authentication": true,
  "workspaceAccess": true,
  "errors": [],
  "recommendations": [
    "System is operating normally",
    "2 workspaces available",
    "5 browsers found in first workspace"
  ]
}

Result: ✅ All systems operational
```

#### Alternative: Diagnostics with Issues
```
Response (with problems):
{
  "connected": false,
  "authentication": false,
  "errors": [
    "Failed to connect to RoxyBrowser API at http://127.0.0.1:50000",
    "Authentication failed - invalid API key"
  ],
  "recommendations": [
    "1. Verify RoxyBrowser application is running",
    "2. Check ROXY_API_KEY environment variable",
    "3. Ensure API is enabled in RoxyBrowser settings",
    "4. Verify port 50000 is not blocked by firewall"
  ]
}

Result: ❌ Issues detected - follow recommendations
```

### Use Cases:
- Troubleshoot connection problems
- Verify API configuration before starting automation
- Check workspace and browser availability
- Get system health report

**Time**: ~3 seconds
**API Calls**: 1 MCP tool
**Benefit**: Comprehensive health check with actionable recommendations

---

## Example 6: Browser Detail Inspection

**Scenario**: User wants to see full configuration of a specific browser.

### Steps:

#### Step 1: Get Browser Detail
```
Call: roxy_get_browser_detail
Parameters:
{
  "workspaceId": 1,
  "dirId": "browser001"
}

Response:
{
  "dirId": "browser001",
  "windowName": "Gmail Automation",
  "projectId": 10,
  "projectName": "Main Project",
  "os": "Windows",
  "osVersion": "11",
  "coreVersion": "143",
  "searchEngine": "Google",
  "openStatus": false,
  "proxyInfo": {
    "proxyCategory": "SOCKS5",
    "host": "proxy.example.com",
    "port": "1080"
  },
  "fingerInfo": {
    "openWidth": "1920",
    "openHeight": "1080",
    "randomFingerprint": true
  },
  // ... full configuration
}

Action: Review configuration, make updates if needed
```

### Use Cases:
- Verify browser configuration
- Check proxy settings
- Review fingerprint settings
- Debug browser behavior

**Time**: ~2 seconds
**API Calls**: 1 MCP tool

---

## Workflow Comparison Table

| Scenario | MCP Tools Used | Time | Complexity |
|----------|---------------|------|------------|
| First-time setup | 4 tools | ~30s | Medium |
| Reuse existing browser | 3 tools | ~10s | Low |
| Check running browsers | 1 tool | ~2s | Very Low |
| Free quota (delete) | 2-3 tools | ~15s | Low |
| Diagnostic check | 1 tool | ~3s | Very Low |
| Inspect browser detail | 1 tool | ~2s | Very Low |

---

## Best Practices Summary

1. **Always start with discovery**
   - Call `roxy_list_workspaces` if you don't know workspace ID
   - Call `roxy_list_browsers` before creating new browsers (avoid duplicates)

2. **Reuse before recreate**
   - Check existing browsers first
   - Only create new browsers when necessary

3. **Clean up properly**
   - Close browsers when done with automation (`roxy_close_browsers`)
   - Delete unused browsers to free quota (`roxy_delete_browsers`)

4. **Verify before acting**
   - Use `roxy_system_diagnostics` when troubleshooting
   - Use `roxy_get_browser_detail` to verify configuration

5. **Save CDP endpoints**
   - Store WebSocket URLs for reconnection
   - Use `roxy_get_connection_info` to retrieve endpoints of running browsers

---

**Next**: See `advanced-usage.md` for proxy configuration, multi-browser management, and complex workflows.
