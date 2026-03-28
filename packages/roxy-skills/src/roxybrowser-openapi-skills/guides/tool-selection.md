# Tool Selection Decision Tree

Use this flowchart to determine which RoxyBrowser MCP tool to call based on user intent.

---

## Primary Decision Flow

```
START: Analyze user request
│
├─── Does user need to CREATE a browser?
│    ├─ YES → `roxy_create_browser`
│    │        ├─ Need proxy? → Get moduleId from `roxy_list_proxies` first
│    │        └─ Returns: dirId (use for opening)
│    └─ NO → Continue
│
├─── Does user need to OPEN an existing browser?
│    ├─ YES → Have dirId?
│    │        ├─ YES → `roxy_open_browser(workspaceId, dirId)`
│    │        │        └─ Returns: CDP WebSocket URL for automation
│    │        └─ NO → Call `roxy_list_browsers` first to get dirId
│    └─ NO → Continue
│
├─── Does user need to VIEW/LIST resources?
│    ├─ Workspaces? → `roxy_list_workspaces`
│    ├─ Browsers? → `roxy_list_browsers` (requires workspaceId)
│    ├─ Proxies? → `roxy_list_proxies` or `roxy_store_proxies`
│    ├─ Accounts? → `roxy_list_accounts`
│    ├─ Labels? → `roxy_list_labels`
│    └─ Connection info? → `roxy_get_connection_info`
│
├─── Does user need to MANAGE proxies?
│    ├─ Create new → `roxy_create_proxy` or `roxy_batch_create_proxies`
│    ├─ Test proxy → `roxy_detect_proxy`
│    ├─ Update proxy → `roxy_modify_proxy`
│    └─ Delete proxy → `roxy_delete_proxies`
│
├─── Does user need to MANAGE accounts?
│    ├─ Create → `roxy_create_account` or `roxy_batch_create_accounts`
│    ├─ Update → `roxy_modify_account`
│    └─ Delete → `roxy_delete_accounts`
│
├─── Does user need to CLOSE/DELETE browsers?
│    ├─ Just close (keep profile) → `roxy_close_browsers`
│    ├─ Delete permanently (FREE QUOTA) → `roxy_delete_browsers` ⚠️
│    └─ ⚠️ IMPORTANT: Closing does NOT free quota!
│
├─── Does user need to MODIFY browser?
│    ├─ Update settings → `roxy_update_browser`
│    ├─ Randomize fingerprint → `roxy_random_fingerprint`
│    ├─ Clear local cache → `roxy_clear_local_cache`
│    └─ Clear server cache → `roxy_clear_server_cache`
│
├─── Does user mention ERRORS or PROBLEMS?
│    ├─ "Quota" or "409" or "101" → Guide to `roxy_delete_browsers`
│    ├─ "Connection" or "401" → `roxy_system_diagnostics`
│    ├─ "Proxy not working" → `roxy_validate_proxy_config` or `roxy_detect_proxy`
│    └─ General troubleshooting → `roxy_system_diagnostics`
│
└─── UNKNOWN intent?
     └─ Ask clarifying question OR call `roxy_system_diagnostics` for health check
```

---

## Scenario-Based Decision Trees

### Scenario A: "I want to automate a task"

```
User wants browser automation
│
├─ Step 1: Get workspace ID
│  └─ Call `roxy_list_workspaces` → Select workspace
│
├─ Step 2: Check existing browsers
│  └─ Call `roxy_list_browsers(workspaceId)`
│     ├─ Found suitable browser? → Use existing dirId
│     └─ No browser? → Create new with `roxy_create_browser`
│
├─ Step 3: Open browser
│  └─ Call `roxy_open_browser(workspaceId, dirId)`
│     └─ Extract CDP WebSocket URL from response
│
├─ Step 4: Automation (outside MCP)
│  └─ User uses CDP endpoint with Playwright/Puppeteer
│
└─ Step 5: Cleanup
   └─ Call `roxy_close_browsers([dirId])`
```

### Scenario B: "I'm getting quota errors"

```
User reports quota/409/101 error
│
├─ Step 1: Explain the issue
│  └─ "Closing browsers doesn't free quota - you must DELETE them"
│
├─ Step 2: Show current browsers
│  └─ Call `roxy_list_browsers(workspaceId)`
│     └─ Display list with dirIds
│
├─ Step 3: Confirm deletion
│  └─ Ask user which browsers to delete
│
└─ Step 4: Delete browsers
   └─ Call `roxy_delete_browsers(workspaceId, [dirId1, dirId2, ...])`
      └─ ✅ Quota now freed
```

### Scenario C: "Set up proxy for browser"

```
User needs proxy configuration
│
├─ Does user have existing proxy in RoxyBrowser?
│  ├─ YES → Call `roxy_list_proxies(workspaceId)` or `roxy_store_proxies(workspaceId)`
│  │        └─ Get moduleId from results
│  │           └─ Use in `roxy_create_browser(proxyInfo: {moduleId: X})`
│  │
│  └─ NO → Need to create proxy
│           ├─ Option 1: Create proxy first
│           │  └─ Call `roxy_create_proxy(workspaceId, protocol, host, port, ...)`
│           │     └─ Get moduleId → Use in browser creation
│           │
│           └─ Option 2: Inline proxy config
│              └─ Call `roxy_create_browser(proxyInfo: {protocol, host, port, ...})`
│
└─ Verify proxy works
   └─ Call `roxy_validate_proxy_config(proxyInfo)` before browser creation
```

### Scenario D: "Troubleshooting connection issues"

```
User reports connection/authentication errors
│
├─ Step 1: Run diagnostics
│  └─ Call `roxy_system_diagnostics(verbose: true)`
│
├─ Step 2: Analyze results
│  ├─ connected: false
│  │  └─ Check: Is RoxyBrowser app running? Firewall blocking port 50000?
│  │
│  ├─ authentication: false
│  │  └─ Check: ROXY_API_KEY environment variable set correctly?
│  │
│  └─ workspaceAccess: false
│     └─ Check: Does workspace exist? Call `roxy_list_workspaces` to verify
│
└─ Step 3: Follow recommendations
   └─ Diagnostics output includes specific troubleshooting steps
```

---

## Parameter Resolution Tree

### When you need `workspaceId`:

```
Do you have workspaceId?
├─ YES → Use it directly
└─ NO → Call `roxy_list_workspaces`
         └─ User selects workspace → Get id field
```

### When you need `dirId` (browser ID):

```
Do you have dirId?
├─ YES → Use it directly
└─ NO → Call `roxy_list_browsers(workspaceId)`
         └─ User selects browser → Get dirId field
         OR
         └─ Call `roxy_create_browser` → Get dirId from response
```

### When you need `moduleId` (proxy ID):

```
Do you have proxy moduleId?
├─ YES → Use in proxyInfo: {moduleId: X}
└─ NO → Two options:
         ├─ Option A: List existing
         │  └─ Call `roxy_list_proxies` or `roxy_store_proxies`
         │     └─ Get id field (this is moduleId)
         │
         └─ Option B: Create new
            └─ Call `roxy_create_proxy`
               └─ Get id from response (this is moduleId)
```

---

## Tool Combination Patterns

### Pattern 1: Complete Browser Automation Setup
```
roxy_list_workspaces
  → roxy_create_browser(workspaceId)
    → roxy_open_browser(workspaceId, dirId)
      → [User automation with CDP endpoint]
        → roxy_close_browsers([dirId])
```

### Pattern 2: Proxy-Enabled Browser
```
roxy_list_proxies(workspaceId) OR roxy_create_proxy(...)
  → roxy_create_browser(workspaceId, proxyInfo: {moduleId})
    → roxy_open_browser(workspaceId, dirId)
```

### Pattern 3: Platform Account Integration
```
roxy_list_accounts(workspaceId) OR roxy_create_account(...)
  → roxy_create_browser(workspaceId, windowPlatformList: [{id: accountId}])
    → roxy_open_browser(workspaceId, dirId)
```

### Pattern 4: Quota Management
```
roxy_list_browsers(workspaceId)
  → [User identifies unused browsers]
    → roxy_delete_browsers(workspaceId, [dirId1, dirId2, ...])
      → ✅ Quota freed for new browsers
```

---

## Quick Reference: Which Tool When?

| If user says... | First tool to call |
|----------------|-------------------|
| "Create a browser" | `roxy_create_browser` |
| "Open browser" | `roxy_open_browser` (need dirId first) |
| "List my browsers" | `roxy_list_browsers` (need workspaceId first) |
| "I don't know my workspace" | `roxy_list_workspaces` |
| "Set up proxy" | `roxy_list_proxies` or `roxy_create_proxy` |
| "Getting quota error" | `roxy_delete_browsers` (NOT close!) |
| "Can't connect" | `roxy_system_diagnostics` |
| "Get CDP endpoint" | `roxy_open_browser` |
| "Delete browser" | `roxy_delete_browsers` |
| "Close browser" | `roxy_close_browsers` (doesn't free quota) |
| "Save credentials" | `roxy_create_account` |
| "Check proxy" | `roxy_validate_proxy_config` or `roxy_detect_proxy` |

---

**Pro Tip**: When in doubt, start with `roxy_list_workspaces` to get the workspace ID, then narrow down from there.
