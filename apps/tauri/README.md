# Tauri + Vue + TypeScript

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 打包（macOS）签名 + 公证（绿色版 .app）

项目默认打绿色版 `.app`（macOS）。bundle 类型由 `src-tauri/tauri.conf.json` 与构建命令参数共同决定（脚本里 macOS 默认 `--bundles app`，Linux 默认 `--bundles appimage`，Windows 默认 `--no-bundle`）。

## 多架构打包（同一平台）

> 说明：Tauri 的“多平台”通常分两类：
>
> - **同一平台多架构**：例如 macOS 同时打 arm64 + x86_64、Windows 同时打 x64 + x86（这是你问的场景）
> - **跨平台**：例如在 macOS 上直接出 Windows 安装包（一般不建议/不支持，需要在对应 OS 上构建）

本项目 `apps/tauri/scripts/tauri-build.ts` 已支持：

- `--all-targets`：按当前操作系统选择默认 Rust targets 并依次构建
  - macOS: `aarch64-apple-darwin`, `x86_64-apple-darwin`
  - Windows: `x86_64-pc-windows-msvc`, `i686-pc-windows-msvc`
  - Linux(AppImage): `x86_64-unknown-linux-gnu`
- `--targets a,b,c`：自定义 targets（逗号分隔）

### 一键命令

```bash
cd apps/tauri

# macOS：同时打 arm64 + intel（开发环境变量 .env.development）
pnpm build:mac

# macOS：只签名，不触发公证（同时打两套架构）
pnpm build:mac:sign-only

# macOS：强制走 ad-hoc（忽略 APPLE_SIGNING_IDENTITY，同时打两套架构）
pnpm build:mac:adhoc

# Windows：同时打 x64 + x86（生产环境变量 .env.production）
pnpm build:win

# Linux：只打 AppImage（默认 x86_64）
pnpm build:linux:appimage
```

### 首次使用需要安装 Rust targets

在对应系统上执行一次：

```bash
# macOS
rustup target add aarch64-apple-darwin x86_64-apple-darwin

# Windows
rustup target add x86_64-pc-windows-msvc i686-pc-windows-msvc

# Linux
rustup target add x86_64-unknown-linux-gnu
```

## 启动参数

- `--show-app-ui`: 显示 UI（否则默认无界面启动）
- `--set-default-browser`: 启动时自动请求设置为系统默认浏览器（macOS），执行完立刻退出（不启动 UI）

## 默认浏览器注册（Windows）AppName/ID 配置

Rust 端在构建时会读取配置并写入编译期常量 `ROXY_DEFAULT_BROWSER_APP_NAME`，用于：

- `HKCU\Software\RegisteredApplications\<AppName>`
- `ProgId` 前缀（例如 `<AppName>URL` / `<AppName>HTML`）

推荐做法：

- **开发/测试**：`RoxyChromeDev`
- **生产**：`RoxyChrome`

### 配置方式（推荐）

由于部分环境会限制 `.env*` 文件的写入/提交，项目支持使用可提交的 `tauri.env` 系列文件：

- 拷贝示例：`apps/tauri/tauri.env.example` → `apps/tauri/tauri.env`
- 写入（开发/测试示例）：

```env
ROXY_DEFAULT_BROWSER_APP_NAME=RoxyChromeDev
```

> 仍然兼容你本地手动创建 `.env.development/.env.production` 的方式（build.rs 会一并读取）。

### 1) 准备环境变量文件

推荐直接编辑并提交（更省事）：

- `apps/tauri/tauri.signing.env`

官方文档（字段名/说明）：`https://v2.tauri.app/distribute/sign/macos/`

### 2) 一键构建

- 签名 +（如果提供了 notarize 凭据则自动公证）：

```bash
cd apps/tauri
pnpm build:mac
```

- 只签名，不触发公证（本地没配 notarize 或网络不通时用）：

```bash
cd apps/tauri
pnpm build:mac:sign-only
```

- 强制走 ad-hoc（忽略 `tauri.signing.env` 里的 `APPLE_SIGNING_IDENTITY`，用于你本机暂时没装证书时）：

```bash
cd apps/tauri
pnpm build:mac:adhoc
```
