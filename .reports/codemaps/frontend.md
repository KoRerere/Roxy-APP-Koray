# Frontend Architecture

<!-- Generated: 2026-03-09 | Files scanned: 120+ | Token estimate: ~900 -->

## Entry Point
apps/web/src/main.ts (72 lines)
- Detects Electron vs web mode
- i18n setup (setupI18n)
- Mounts Vue app after locale initialization

## Page Tree

```
/ (Layout)
├── /browser-list (Browser Management)
│   ├── /profiles (Profile CRUD)
│   └── /cookie (Cookie Editor)
├── /agent (AI Agent Dashboard)
├── /mcp (MCP Server Management)
├── /projects (Project Management)
├── /extensions (Browser Extensions)
├── /api-keys (API Key Management)
├── /pay (Payment & Subscription)
├── /team (Team Management)
├── /workspace-setting (Workspace Config)
├── /sync-control (Profile Sync)
├── /campaign (Marketing Campaigns)
├── /lab (Experimental Features)
├── /account (User Account)
├── /referral-program (Referral System)
└── /tutorial (Onboarding)
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
- **user.ts**: Authentication, user info, token
- **workspace.ts**: Current workspace, role, type (Private/Public)
- **locale.ts**: i18n language selection
- **theme.ts**: Dark/light theme
- **browser.ts**: Browser instance state

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
- message/: Message-based API calls
  - checkAppVersion, checkCoreVersion, checkDictVersion
  - checkNotify, checkPermission, checkSoftConfigVersion

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
