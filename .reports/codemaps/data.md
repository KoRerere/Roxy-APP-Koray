# Data & Storage

<!-- Generated: 2026-03-26 | Files scanned: 40+ | Token estimate: ~700 -->

## Electron Store

### Local Config (apps/electron/src/modules/store/)
- Persistent key-value storage
- Stores: token, language, proxy settings, browser profiles
- File location: User data directory

### Store Schema
```typescript
{
  token: string
  language: 'zh-CN' | 'en' | 'ru'
  softConfig: {
    proxySettings: ProxyConfig
    autoStart: boolean
  }
  browserProfiles: BrowserProfile[]
}
```

## Browser Profiles

### Profile Structure
```typescript
interface BrowserProfile {
  id: string
  name: string
  fingerprint: FingerprintConfig
  proxy: ProxyConfig
  cookies: Cookie[]
  userAgent: string
  viewport: { width: number, height: number }
  timezone: string
  locale: string
}
```

### Storage Location
- Profile data: User data directory / profiles / {profileId}
- Chrome user data: User data directory / chrome-profiles / {profileId}

## Cookie Management

### Cookie Storage
- Stored per profile in browser profile directory
- Synced to backend API for team sharing
- Cookie robot for automated cookie collection

### Cookie Schema
```typescript
interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'Strict' | 'Lax' | 'None'
}
```

## Pinia Persistence

### Persisted Stores
- pinia-plugin-persistedstate: Auto-persist to localStorage
- Stores: user, workspace, locale, theme

### Storage Keys
```
locale: { currentLocale: string }
user: { token: string, userInfo: UserInfo }
workspace: { currentWorkspace: Workspace }
theme: { theme: 'light' | 'dark' }
```

## Backend API Data

### API Endpoints (via @roxy/backend-api)
- User management
- Browser profile CRUD
- Cookie synchronization
- Team management
- Payment & subscription
- MCP server configuration

### Data Sync Flow
```
Local Profile → API POST /profiles → Backend DB
Backend DB → API GET /profiles → Local Cache
```

## Logs

### Log Files (apps/electron/src/modules/log/)
- electron-log: Main process logs
- Log directory: User data directory / logs
- Rotation: Daily, max 7 days

### Log Levels
- error: Critical failures
- warn: Non-critical issues
- info: General information
- debug: Detailed debugging (DEBUG=true)

## Key Files
- apps/electron/src/modules/store/index.ts: Store initialization
- packages/roxy-shared/: Shared type definitions
- packages/backend-api/: OpenAPI client
