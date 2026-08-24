# Telegram 扫码接入

## 结论

Telegram 官方 Bot 接入没有扫码创建流程，推荐使用 BotFather 生成 Bot Token。Telegram 的 QR Login 是用户账号登录协议，不是 Bot API，不能把它得到的 session 转换成 Bot Token。

## 官方 Bot 流程

1. 在 Telegram 中打开 `@BotFather`。
2. 执行 `/newbot`，获得 Bot Token。
3. Roxy Agent 调用 `getMe` 验证 Token。
4. 用户向 Bot 发送 `/start`，服务端获取 `chat_id`。
5. 通过 Bot API long polling 或 webhook 收发消息。

当前适配器 `src/im/telegram/adapter.ts` 使用 Grammy，通过 `getMe` 做连通性检查，并用 `TELEGRAM_ALLOWED_CHAT_IDS` 做白名单。

## 扫码方案一：Bot 深链二维码（推荐）

如果目标只是让用户方便绑定 Bot，可以把以下链接生成二维码：

```text
https://t.me/{bot_username}?start={one_time_state}
```

用户扫码进入 Bot 并发送 `/start`，Agent 校验一次性 state 后将该用户的 `chat_id` 绑定到 Roxy workspace。这是“扫码打开 Bot”，不是“扫码授权 Telegram 账号”。

实现时：

- state 必须短时有效、单次消费，并绑定用户/workspace；
- 绑定成功后只保存 Telegram `chat_id`，不保存用户账号 session；
- 二维码可复用 Web 应用现有 `qrcode` 包生成。

## 扫码方案二：用户账号 QR Login（不建议）

Telegram 用户账号 QR Login 基于 MTProto/TDLib：

1. 客户端创建临时授权 token。
2. 生成 `tg://login?token=...` 二维码。
3. 用户在已登录的 Telegram 客户端确认登录。
4. 客户端保存 MTProto session。

这需要实现客户端协议、token 过期/拒绝、二次验证和加密 session 存储。它不应接入当前 Bot 适配器；如果未来支持，应单独命名为 `telegram-user-session`，并放在实验开关之后。

## Roxy Agent 配置

当前字段：

```text
tg_bot_token
tg_allowed_chat_ids
```

不要新增一个“Telegram QR Bot Token”字段。二维码只产生深链绑定 state，Bot Token 仍然由 BotFather 创建并由服务端保存。

参考：[Telegram Bot API](https://core.telegram.org/bots/api)、[Telegram QR Login](https://core.telegram.org/api/qr-login)
