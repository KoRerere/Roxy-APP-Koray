# Tauri + Vue + TypeScript

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 打包（macOS）签名 + 公证（绿色版 .app）

项目已配置为只打绿色版：`src-tauri/tauri.conf.json` 的 `bundle.targets=["app"]`，产物是 `.app`。

## 启动参数

- `--show-app-ui`: 显示 UI（否则默认无界面启动）
- `--set-default-browser`: 启动时自动请求设置为系统默认浏览器（macOS），执行完立刻退出（不启动 UI）

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
