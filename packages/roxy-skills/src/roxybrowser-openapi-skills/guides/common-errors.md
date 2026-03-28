# Common Errors Reference Guide

Quick reference for troubleshooting RoxyBrowser MCP errors.

## Contents
- [Error Code Table](#error-code-table)
- [Bilingual Error Messages](#bilingual-error-messages)
- [Error Categories](#error-categories)
  - [Authentication Errors](#authentication-errors-401-403)
  - [Quota Errors](#quota-errors-409-101)
  - [Resource Not Found](#resource-not-found-404)
  - [Network/Connection Errors](#networkconnection-errors-408-500-503-504)
  - [Proxy Errors](#proxy-errors-502)
  - [Parameter Errors](#parameter-errors-400)
- [Error Prevention Checklist](#error-prevention-checklist)
- [Troubleshooting Workflow](#troubleshooting-workflow)
- [Quick Error-Solution Lookup](#quick-errorsolution-lookup)

---

## Error Code Table

| Code | Name | Meaning | Common Causes | Solution | Related Tools |
|------|------|---------|---------------|----------|---------------|
| **0** | SUCCESS | Operation successful | N/A | N/A | All tools return this on success |
| **101** | INSUFFICIENT_QUOTA | Browser profile quota exceeded | Too many browsers created, subscription limit reached | Use `roxy_delete_browsers` to free quota (NOT close!) | `roxy_delete_browsers`, `roxy_list_browsers` |
| **400** | INVALID_PARAMS | Invalid parameters provided | Missing required fields, wrong data types, invalid enum values | Check tool inputSchema, verify all required fields | `roxy_system_diagnostics` for validation |
| **401** | UNAUTHORIZED | Authentication failed | Invalid API key, expired token, missing ROXY_API_KEY env var | Verify `ROXY_API_KEY` in environment, check RoxyBrowser API settings | `roxy_system_diagnostics` |
| **403** | FORBIDDEN | Access denied | Insufficient permissions, workspace/resource not owned by user | Verify workspace ownership with `roxy_list_workspaces` | `roxy_list_workspaces` |
| **404** | NOT_FOUND | Resource not found | Invalid workspaceId/dirId, browser deleted, proxy doesn't exist | List resources first to verify IDs exist | `roxy_list_browsers`, `roxy_list_workspaces`, `roxy_list_proxies` |
| **408** | TIMEOUT | Request timeout | Network slow, RoxyBrowser server overloaded | Retry request, check network connection, increase ROXY_TIMEOUT | `roxy_system_diagnostics` |
| **409** | CONFLICT | Resource conflict / Quota issue | Browser quota exceeded (Chinese: "额度不足"), resource already exists | Same as 101 - use `roxy_delete_browsers` to free quota | `roxy_delete_browsers` |
| **500** | SERVER_ERROR | Internal server error | RoxyBrowser backend issue, database problem | Retry after delay, check RoxyBrowser app logs, contact support | `roxy_system_diagnostics` |
| **502** | BAD_GATEWAY | Bad gateway | Proxy configuration issue, network routing problem | Verify proxy with `roxy_validate_proxy_config`, check proxy connectivity | `roxy_validate_proxy_config`, `roxy_detect_proxy` |
| **503** | SERVICE_UNAVAILABLE | Service temporarily unavailable | RoxyBrowser app not running, API disabled, maintenance mode | Start RoxyBrowser app, enable API in settings | `roxy_system_diagnostics` |
| **504** | GATEWAY_TIMEOUT | Gateway timeout | Proxy timeout, network latency too high | Check proxy status, use faster proxy, increase timeout | `roxy_detect_proxy` |

---

## Bilingual Error Messages

Common error messages you might see (Chinese/English):

| Chinese Message | English Meaning | Error Code | Solution |
|----------------|-----------------|------------|----------|
| "额度不足" | Insufficient quota | 409/101 | Delete browsers with `roxy_delete_browsers` |
| "认证失败" | Authentication failed | 401 | Check ROXY_API_KEY environment variable |
| "浏览器不存在" | Browser not found | 404 | Verify dirId with `roxy_list_browsers` |
| "工作区不存在" | Workspace not found | 404 | List workspaces with `roxy_list_workspaces` |
| "代理配置错误" | Proxy configuration error | 502 | Validate with `roxy_validate_proxy_config` |
| "参数错误" | Parameter error | 400 | Check required fields and data types |
| "连接超时" | Connection timeout | 408/504 | Check network, increase timeout |
| "服务不可用" | Service unavailable | 503 | Ensure RoxyBrowser app is running |

---

## Error Categories

### Authentication Errors (401, 403)

**Symptoms:**
- "Authentication failed"
- "Invalid API key"
- "Access denied"

**Diagnosis:**
```bash
# Check if ROXY_API_KEY is set
echo $ROXY_API_KEY

# Verify RoxyBrowser API is enabled
# RoxyBrowser → API → API Status = Enable
```

**Solutions:**
1. Set environment variable: `export ROXY_API_KEY="your_key_here"`
2. Open RoxyBrowser → API → Copy API Key
3. Verify API is enabled in RoxyBrowser settings
4. Run `roxy_system_diagnostics` to confirm authentication

**Related Tools:**
- `roxy_system_diagnostics` - Test authentication status

---

### Quota Errors (409, 101)

**Symptoms:**
- "Insufficient profiles quota"
- "额度不足" (Chinese)
- Error when creating/opening browsers

**⚠️ CRITICAL MISUNDERSTANDING:**
- ❌ **WRONG**: "I'll close browsers to free quota" → `roxy_close_browsers`
- ✅ **CORRECT**: "I'll delete browsers to free quota" → `roxy_delete_browsers`

**Solutions:**
1. List current browsers: `roxy_list_browsers(workspaceId)`
2. Identify unused browsers (check `status` field)
3. Delete permanently: `roxy_delete_browsers(workspaceId, [dirId1, dirId2, ...])`
4. Alternative: Purchase more quota in RoxyBrowser Billing Center

**Related Tools:**
- `roxy_list_browsers` - See current quota usage
- `roxy_delete_browsers` - Free quota (REQUIRED)
- `roxy_close_browsers` - Only closes, doesn't free quota ⚠️

---

### Resource Not Found (404)

**Symptoms:**
- "Browser not found"
- "Workspace does not exist"
- "Proxy ID invalid"

**Common Causes:**
- Using outdated dirId (browser was deleted)
- Wrong workspaceId
- Typo in resource ID

**Solutions:**
1. **For workspaces**: Call `roxy_list_workspaces` to get valid IDs
2. **For browsers**: Call `roxy_list_browsers(workspaceId)` to verify dirId exists
3. **For proxies**: Call `roxy_list_proxies(workspaceId)` to get valid proxy IDs
4. **For accounts**: Call `roxy_list_accounts(workspaceId)` to verify account IDs

**Related Tools:**
- `roxy_list_workspaces`
- `roxy_list_browsers`
- `roxy_list_proxies`
- `roxy_list_accounts`

---

### Network/Connection Errors (408, 500, 503, 504)

**Symptoms:**
- "Connection timeout"
- "Service unavailable"
- "Cannot connect to RoxyBrowser API"

**Diagnosis Checklist:**
```
□ Is RoxyBrowser application running?
□ Is API enabled? (RoxyBrowser → API → Enable)
□ Is firewall blocking port 50000?
□ Is ROXY_API_HOST correct? (default: http://127.0.0.1:50000)
□ Is network stable?
```

**Solutions:**
1. Start RoxyBrowser application
2. Enable API in settings
3. Check firewall rules for port 50000
4. Verify `ROXY_API_HOST` environment variable
5. Run `roxy_system_diagnostics(verbose: true)` for detailed check
6. Increase timeout: `export ROXY_TIMEOUT=60000` (60 seconds)

**Related Tools:**
- `roxy_system_diagnostics` - Comprehensive health check

---

### Proxy Errors (502)

**Symptoms:**
- "Bad gateway"
- "Proxy connection failed"
- Browser opens but can't access internet

**Common Causes:**
- Invalid proxy credentials
- Proxy server down
- Wrong proxy protocol (HTTP vs SOCKS5)
- Proxy requires authentication but none provided

**Solutions:**
1. Validate before use: `roxy_validate_proxy_config(proxyInfo)`
2. Test proxy: `roxy_detect_proxy(workspaceId, proxyId)`
3. Check proxy credentials (proxyUserName, proxyPassword)
4. Verify proxy protocol matches (HTTP/HTTPS/SOCKS5)
5. Try different checkChannel in proxy config

**Related Tools:**
- `roxy_validate_proxy_config` - Pre-flight validation
- `roxy_detect_proxy` - Test connectivity and update IP info
- `roxy_list_proxies` - Check proxy status (checkStatus field)

---

### Parameter Errors (400)

**Symptoms:**
- "Invalid parameters"
- "Missing required field"
- "workspaceId is required"

**Common Mistakes:**
1. **Missing workspaceId**: Almost all tools need this - get from `roxy_list_workspaces`
2. **Wrong data type**: e.g., passing string instead of number for IDs
3. **Invalid enum value**: e.g., `os: "win"` instead of `os: "Windows"`
4. **Conflicting parameters**:
   - ❌ Passing both `moduleId` AND `host/port` in proxyInfo
   - ❌ Passing both `id` AND `platformUserName/platformPassword` in windowPlatformList

**Solutions:**
1. Check tool's `inputSchema` in skill.md
2. Verify required fields are provided
3. Use correct data types (number vs string vs boolean)
4. Use valid enum values (check skill.md for allowed values)
5. Avoid parameter conflicts (see Critical Rules in skill.md)

**Related Tools:**
- `roxy_system_diagnostics` - Can help identify parameter issues

---

## Error Prevention Checklist

Before calling tools, verify:

### ✅ Before `roxy_create_browser`:
- [ ] Have valid workspaceId from `roxy_list_workspaces`
- [ ] If using proxy: validated with `roxy_validate_proxy_config` OR got moduleId from `roxy_list_proxies`
- [ ] If using platform account: got account id from `roxy_list_accounts`
- [ ] Check available quota (not at limit)

### ✅ Before `roxy_open_browser`:
- [ ] Have valid dirId from `roxy_create_browser` or `roxy_list_browsers`
- [ ] Browser exists and is not corrupted
- [ ] Not hitting concurrent open limit

### ✅ Before `roxy_delete_browsers`:
- [ ] Confirmed user wants to DELETE (not just close)
- [ ] Listed browsers first so user can select which to delete
- [ ] Warned user that deletion is permanent

### ✅ Before proxy operations:
- [ ] Proxy credentials are correct
- [ ] Protocol matches proxy type (HTTP/SOCKS5/etc.)
- [ ] Used `roxy_validate_proxy_config` first

---

## Troubleshooting Workflow

```
Error encountered
│
├─ Step 1: Check error code
│  └─ Refer to Error Code Table above
│
├─ Step 2: Identify category
│  ├─ Authentication? → Check ROXY_API_KEY
│  ├─ Quota? → Use roxy_delete_browsers
│  ├─ Not Found? → List resources to verify IDs
│  ├─ Network? → Check RoxyBrowser app running
│  └─ Proxy? → Validate proxy config
│
├─ Step 3: Run diagnostics
│  └─ Call `roxy_system_diagnostics(verbose: true)`
│     └─ Follow recommendations in output
│
└─ Step 4: Apply solution
   └─ Use Related Tools from table above
```

---

## Quick Error→Solution Lookup

| Error Message Contains | Likely Issue | Quick Fix |
|----------------------|--------------|-----------|
| "quota" / "额度不足" | Quota exceeded | `roxy_delete_browsers` (not close!) |
| "authentication" / "认证" | Invalid API key | Check ROXY_API_KEY env var |
| "not found" / "不存在" | Invalid ID | List resources first (`roxy_list_*`) |
| "connection" / "连接" | Network/app issue | Start RoxyBrowser, check port 50000 |
| "proxy" / "代理" | Proxy config wrong | `roxy_validate_proxy_config` |
| "timeout" / "超时" | Request too slow | Increase ROXY_TIMEOUT, check network |
| "parameter" / "参数" | Wrong input | Check inputSchema, verify required fields |

---

**Pro Tip**: When facing persistent errors, always start with `roxy_system_diagnostics(verbose: true)` - it provides comprehensive health checks and specific recommendations.
