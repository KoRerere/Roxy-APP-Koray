# Delay Launcher（一次性冷启动模拟器）

用于在**已打包/本地安装**的 Roxy 上**只模拟一次**内核冷启动变慢，验证启动超时相关行为。

## 原理（一次性）

1. 安装时：`RoxyChrome.exe` → `RoxyChrome_real.exe`，延迟器顶替为 `RoxyChrome.exe`
2. **第一次**启动：延迟器 sleep `N` 秒 → 把真内核**还原**回 `RoxyChrome.exe` → 再 spawn 真内核
3. **之后**启动：目录里已是真 `RoxyChrome.exe`，**不会再次延迟**

仍支持自定义延迟秒数（打包档位 / 环境变量 / 文件名）。

```text
安装后目录：
  RoxyChrome.exe       ← 延迟器（一次性）
  RoxyChrome_real.exe  ← 真内核

第一次启动结束后（成功走完延迟逻辑）：
  RoxyChrome.exe           ← 已还原的真内核
  RoxyChrome_delay_used.exe← 残留延迟器（会尝试自动删除）
```

---

## 目录结构

```text
tools/delay-launcher/
  launcher.mjs       # 一次性延迟 + 还原逻辑
  build.mjs          # 跨平台打包（@yao-pkg/pkg）
  install-win.ps1    # Windows 安装 / 还原 / 列表
  dist/              # 构建产物（gitignore）
```

---

## 1. 打包

```bash
pnpm build:delay-launcher
node tools/delay-launcher/build.mjs --delays=10,35,50,70 --targets=win-x64
pnpm build:delay-launcher:all
```

| 参数 | 说明 | 默认 |
|------|------|------|
| `--delays=` | 逗号分隔秒数 | `10,35,50,70` |
| `--targets=` | `win-x64` / `macos-x64` / `macos-arm64` / `linux-x64` | 当前主机 |

---

## 2. Windows 安装

| `-AppEnv` | 目录 |
|-----------|------|
| `dev` / `test` | `%APPDATA%\RoxyBrowserDev\chrome-bin\<version>` |
| `prod` | `%APPDATA%\RoxyBrowser\chrome-bin\<version>` |

`-Env` 为 `-AppEnv` 别名。

```powershell
# 列出内核
powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -List

# 安装 35s 一次性冷启动
powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -CoreVersion 150 -Delay 35

# 安装 70s
powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -CoreVersion 150 -Delay 70

# 正式环境
powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv prod -CoreVersion 150 -Delay 35

# 若第一次启动失败且未还原，可手动还原
powershell -ExecutionPolicy Bypass -File tools/delay-launcher/install-win.ps1 -AppEnv dev -CoreVersion 150 -Restore
```

---

## 3. 延迟档参考（Chrome 默认启动超时约 30s）

| 档次 | 第一次启动期望 | 第二次启动 |
|------|----------------|------------|
| **10s** | 通常直接成功 | 正常速度 |
| **35s** | 可能触发启动超时 | 正常速度（已还原） |
| **50s** | 通常超时失败 | 正常速度 |
| **70s** | 超时失败 | 若已还原则正常 |

要再测一次冷启动：重新执行 `install-win.ps1`。

---

## 4. 运行时覆盖

```bash
set ROXY_DELAY_SECONDS=35
set ROXY_REAL_EXE=C:\path\to\RoxyChrome_real.exe
```

---

## 5. 注意事项

- 安装/重装前请退出对应环境客户端，避免 exe 占用
- **测完若目录仍是延迟器**（中途杀进程导致未还原），用 `-Restore`
- `dist/` 勿提交；仅研发自测，不要打进正式安装包
- 请使用 `pnpm build:delay-launcher` 重新打包后再安装

### 已知坑（已修复）

旧逻辑 `argv.slice(1)` 会把 pkg 的 `/snapshot/.../launcher_XXs.js` 传给 Chrome。  
现已改为 `slice(2)`。

旧逻辑用 `windowsHide: true`，真 Chrome 会挂在 Node 包装进程下且窗口无法自动激活到前台。  
现已去掉 `windowsHide`；窗口未激活时可在前端点「查看」唤醒（与线上一致）。

**约束：** delay-launcher 必须对 Electron 透明——包装进程不可在 spawn 真内核后提前 exit 0，  
否则会被 APP 判定为启动失败。包装进程应作为 browserProcess 存活，直到真 Chrome 退出；  
子进程 exit 0（单实例唤醒）时包装进程保持运行，由 Electron 在关闭窗口时 kill。
