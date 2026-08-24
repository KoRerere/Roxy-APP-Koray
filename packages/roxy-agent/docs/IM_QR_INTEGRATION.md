# Roxy Agent IM 接入文档索引

本文档目录按平台拆分扫码接入方案。先阅读对应平台文档，再参考统一的连接模型和安全要求。

## 平台文档

- [Discord 扫码接入](./DISCORD_QR_INTEGRATION.md)
- [企业微信扫码接入](./WECOM_QR_INTEGRATION.md)
- [Telegram 扫码接入](./TELEGRAM_QR_INTEGRATION.md)
- [WhatsApp 扫码接入](./WHATSAPP_QR_INTEGRATION.md)

## 总体原则

“扫码接入”可能代表两类流程：

1. **官方应用授权**：OAuth、应用安装、企业管理员授权，适合生产机器人和客服。
2. **个人账号设备登录**：Web/Desktop session、cookies 或 MTProto session，风险较高，不应与官方 Bot 适配器混用。

四个平台不能统一设计为“二维码换 Bot Token”：

| 平台 | 生产推荐 |
| --- | --- |
| Discord | OAuth2 安装 Bot + Bot Token |
| 企业微信 | 企业应用回调 + Corp Secret，或第三方服务商授权 |
| Telegram | BotFather + Bot Token |
| WhatsApp | WhatsApp Business Platform / Embedded Signup |

## 统一连接模型

```typescript
type ImPlatform = 'discord' | 'wecom' | 'telegram' | 'whatsapp'
type ImAuthMode = 'official_bot' | 'oauth_install' | 'qr_user_session' | 'webhook'

interface ImConnection {
  id: string
  platform: ImPlatform
  authMode: ImAuthMode
  status: 'pending' | 'awaiting_scan' | 'authorizing' | 'connected' | 'expired' | 'failed' | 'revoked'
  displayName?: string
  accountId?: string
  expiresAt?: string
  credentialRef: string // 服务端密文引用，前端不返回 Token/Secret
}
```

建议统一提供：

```text
POST   /api/roxy-claw/connections/{platform}/start
GET    /api/roxy-claw/connections/{connectionId}
DELETE /api/roxy-claw/connections/{connectionId}
```

二维码和 OAuth state 必须短时有效，并绑定用户、workspace、connectionId。回调型平台（企业微信、WhatsApp）必须有公网 HTTPS 入口，不能只依赖 Electron 本机地址。

仓库 Web 应用已经依赖 `qrcode`，飞书和微信配置页可作为二维码渲染参考：

- `apps/web/src/views/agent-console/pages/roxy-claw/lark-config.vue`
- `apps/web/src/views/agent-console/pages/roxy-claw/wechat-config.vue`
