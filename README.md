# Electron Vite Monorepo

An Electron + Vite Monorepo Demo

Uses:

- Vue.js
- Typescript
- Turborepo
- Vite (for Electron builds)

## Getting Started

```bash
pnpm install
pnpm run dev

# 生成语言文件
pnpm genLanguage

# 生成接口请求
pnpm openapi
```

https://vue-i18n.intlify.dev/guide/advanced/component

tail -f 2024-11-06.log | grep -A 3 "目标被创建\|url 改变\|目标被销毁\|同步标签页"

获取未翻译的 key 的 JSON:
JSON.stringify(Object.fromEntries(Object.entries(a).filter(([key,value]) => value === '')))

# electron 执行文件下载失败时，VPN 工具开启 tun mode，并手动执行 ELECTRON_GET_USE_PROXY=true node node_modules/electron/install.js

https://www.ihuandu.com/help/faq/715.html

# 给其他 exe 签名

"C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe" sign /fd SHA256 /tr http://timestamp.globalsign.com/tsa/r6advanced1 /td SHA256 /n "LINKV TECH PTE. LTD." "C:\Users\Administrator\Documents\WXWork\1688858059813454\Cache\File\2026-05\roxynet\x64\roxynet.exe"
