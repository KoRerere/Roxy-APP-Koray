# Frontend Architecture

<!-- Generated: 2026-03-26 | Files scanned: 120+ | Token estimate: ~900 -->

## Entry Point
apps/web/src/main.ts (72 lines)
- Detects Electron vs web mode
- i18n setup (setupI18n)
- Mounts Vue app after locale initialization

## Page Tree

```
/ (Layout)
├── /browser (Browser Management)
│   ├── /list - All windows
│   ├── /create - New window
│   ├── /edit - Edit window
│   └── /shared - Shared windows
├── /projects (Project Management)
│   ├── /list - Project list
│   └── /:id - Project detail
├── /resource (Tools Group)
│   ├── /agent - Proxy IP management
│   ├── /account - Platform accounts
│   ├── /extensions - Extension center
│   └── /cattle-slaughter - Lab (experimental)
├── /automation (Automation Group)
│   ├── /sync-control - Window synchronization (Windows only)
│   └── /api-keys - API & AI MCP
├── /workspace (Team Collaboration)
│   └── /teams - Team management
├── /subscribe-plan - Plan selection (Owner only)
├── /upgrade-plan - Plan upgrade (Owner only)
├── /wallet - Cost center (Owner only)
└── /tutorial - Onboarding
```

## Component Hierarchy

### Layout (apps/web/src/layout/)
- index.vue: Main layout wrapper
- Sidebar navigation
- Header with user menu

### Custom Components (apps/web/src/components/)
- rx-* prefix: Custom PrimeVue-styled components
  - rx-button, rx-form, rx-table, rx-dialog, etc.
- business/global-component/: Business logic components
- remark-icon/: Icon system

## State Management (Pinia)

### Core Stores (apps/web/src/stores/)
- **user.ts**: Authentication, user info, token, payment info
- **workspace.ts**: Current workspace, role, type (Private/Public), getPermissionByWorkspace()
- **permission.ts**: Permission rules (NEW) — allow/deny effects, can()/cannot()/canAny()/canAll()
- **locale.ts**: i18n language selection
- **theme.ts**: Dark/light theme
- **browser.ts**: Browser instance state
- **role.ts**: User role information
- **team.ts**: Team data
- **project.ts**: Project state
- **lock.ts**: Lock screen state
- **network.ts**: Network state

### Permission System (NEW)
- Route-level: `meta.permissions` array with `permissionMode` ('all' | 'any')
- Component-level: `usePermission()` composable
- Backend sync: `checkPermissionVersion.ts` monitors version header
- Permission codes: Profiles_add, Profiles_edit, Projects_view_page, Proxy_List_view_page,
  Platform_view_page, Plugin_Installed_view_page, API_MCP_view_page, Team_Member_view_page

### Store Flow
```
Component → useUserStore() → API call → Update state → Reactive UI
```

## Routing

### Router Setup (apps/web/src/router/)
- index.ts: Router configuration, navigation guards
- menu.ts: Menu route definitions
- base.ts: Base routes (login, oauth2callback)

### Navigation Guards
- Token check: Redirect to /login if no token
- Role check: Restrict routes by workspace role
- Workspace type check: Private vs Public workspace routing

## API Layer

### API Structure (apps/web/src/api/)
- index.ts: Axios instance configuration
- message/: Version-based sync checks
  - checkAppVersion, checkCoreVersion, checkDictVersion
  - checkNotify, checkPermission, checkSoftConfigVersion
  - checkPermissionVersion (NEW): Permission version sync
  - checkPayInfoVersion: Payment info sync

### Electron API Polyfill (apps/web/src/electron-api-polyfill/)
- Provides electronAPI shim for web mode
- Falls back to HTTP API when not in Electron

## Key Files
- apps/web/src/app.ts (1773 lines): Vue app initialization
- apps/web/src/views/browser/list/profiles/hooks/useCookie.tsx: Cookie management hook
- apps/web/src/stores/user.ts: User authentication state

## UI Framework
- PrimeVue 4.5.4: Component library
- UnoCSS: Utility-first CSS
- Sass: Styling preprocessor
- Motion-v: Animation library
