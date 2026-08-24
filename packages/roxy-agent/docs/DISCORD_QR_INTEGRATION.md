# Discord 扫码接入

## 结论

Discord Bot 没有“扫码登录 Bot 账号”的官方流程。生产方案是创建 Discord Application/Bot，生成 OAuth2 安装 URL，再把这个 URL 渲染成二维码。用户扫码后选择服务器并授权；二维码不会返回 Bot Token。

不要实现 Discord 用户账号二维码登录来驱动 Agent。使用用户 session 自动回复属于 self-bot/账号自动化，存在封号和合规风险。

## 官方流程

1. 在 [Discord Developer Portal](https://discord.com/developers/applications) 创建 Application。
2. 在 **Bot** 页面创建 Bot，获取 `DISCORD_BOT_TOKEN`。
3. 配置需要的 Gateway Intents，确认 `MESSAGE_CONTENT` 是否满足消息读取需求。
4. 生成 OAuth2 安装 URL：

   ```text
   https://discord.com/oauth2/authorize
     ?client_id={APPLICATION_ID}
     &scope=bot%20applications.commands
     &permissions={PERMISSIONS_INTEGER}
   ```

5. 前端将 `installUrl` 生成二维码，用户扫码并点击授权。
6. Bot 使用 Gateway 或 REST API 收发消息。

二维码只是 OAuth2 URL 的展示形式，Bot Token 仍由应用所有者配置并由服务端保管。

## Roxy Agent 映射

- 适配器：`src/im/discord/adapter.ts`
- 当前配置：`discord_bot_token`、`discord_allowed_user_ids`
- 连通性检查：`POST /api/roxy-claw/test/discord`
- 当前缺口：没有生成 OAuth2 安装 URL 的接口。

建议新增：

```text
POST /api/roxy-claw/discord/install-link
-> { applicationId, installUrl, expiresAt }
```

该接口不应返回 Bot Token。二维码可以在 Web UI 使用现有 `qrcode` 依赖生成。

## 权限与安全

- `permissions` 只申请 Agent 实际需要的最小权限。
- OAuth2 URL 中的 `state`（如需要回调）必须绑定当前用户和 workspace。
- Bot Token 只存服务端密文引用，日志中不得打印。
- 入站消息继续使用 `DISCORD_ALLOWED_USER_IDS` 做白名单校验。

参考：[Discord OAuth2](https://discord.com/developers/docs/topics/oauth2)
