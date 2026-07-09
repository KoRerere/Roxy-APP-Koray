# @roxy/crypto

AES-256-GCM 加解密，核心逻辑在 Rust WASM 中实现，密钥分片内联于 WASM，避免明文暴露在 JS 源码。

## 构建

```bash
pnpm -F @roxy/crypto build
```

默认使用仓库内已提交的 `pkg/` WASM 产物，**无需安装 Rust/wasm-pack**。

仅在修改 `wasm/` 源码时需要重新编译 WASM（需已安装 Rust + wasm-pack）：

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
pnpm -F @roxy/crypto build
```

若终端提示找不到 `wasm-pack`，通常是因为 `%USERPROFILE%\.cargo\bin` 未加入 PATH；构建脚本会自动尝试该路径，也可手动设置：

```bash
set WASM_PACK=%USERPROFILE%\.cargo\bin\wasm-pack.exe
```

## API

- `initCrypto()` — 应用启动时调用一次
- `encryptAESGCM(msg)` / `decryptAESGCM(str)` — API 互通加解密（固定密钥）
- `encryptAESGCMLocal(msg, sessionMaterial)` / `decryptAESGCMLocal(str, sessionMaterial)` — 本地敏感数据（v2 前缀）
- `decryptLocalPassword(encrypted, sessionMaterial)` — 兼容 v2 / v1 / 明文
