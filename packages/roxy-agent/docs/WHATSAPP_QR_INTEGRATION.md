# WhatsApp 扫码接入

## 结论

WhatsApp Cloud API 没有“扫描手机 WhatsApp 二维码后返回个人号 Bot Token”的官方流程。生产环境应使用 WhatsApp Business Platform；WhatsApp Web 扫码属于个人号/设备会话托管，风险较高。

## 官方生产方案：WhatsApp Business Platform

1. 创建 Meta App 和 Business Portfolio。
2. 使用 [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/) 让企业管理员登录 Meta 并授权业务资产。
3. 绑定或验证 WhatsApp Business Phone Number。
4. 获取 `waba_id`、`phone_number_id` 和 system-user access token。
5. 配置 Webhook 验证和消息订阅。
6. Agent 使用 Graph API 发送消息，使用 Webhook 接收入站消息。

Embedded Signup 可以放入 Roxy 的安装向导。若需要二维码，只需把安装 URL 编码成二维码；二维码承载的是 Meta OAuth/安装入口，不是 WhatsApp Web 登录凭证。

## 个人号/WhatsApp Web 托管（不建议默认实现）

非官方 WhatsApp Web 方案通常如下：

1. 启动持久化浏览器或协议客户端。
2. 生成 pairing QR。
3. 用户在手机的“已连接的设备”中扫码。
4. 保存认证状态（LocalAuth/Signal 凭证等）。
5. 监听消息事件并发送回复。

这需要处理 session 加密、断线重连、二维码过期和重新扫码，且可能违反 WhatsApp 条款并触发账号风控。它不能与 Cloud API 的 `phone_number_id` 或 system token 混用，也不应默认随 Roxy Agent 发布。

## 客户入口二维码

WhatsApp Business 还支持生成客户入口二维码，内容通常是 `wa.me` 链接和预填消息。它的作用是“客户扫码联系企业”，不是“企业扫码把 WhatsApp 接入 Agent”，在产品 UI 和数据模型中必须分开。

## Roxy Agent 实现建议

新增独立的 `src/im/whatsapp/` 适配器，至少包含：

- `oauth.ts`：Embedded Signup、OAuth state 和回调；
- `webhook.ts`：签名校验、消息解析和去重；
- `adapter.ts`：消息归一化、文本/媒体发送；
- `token.ts`：system-user token 和业务 token 的加密存储、轮换。

建议凭证字段：

```text
wabaId, phoneNumberId,
systemUserAccessToken, webhookVerifyToken,
webhookAppSecret
```

Webhook 必须使用公网 HTTPS。OAuth state 和授权 code 要短时有效并绑定 workspace；Token 不得返回渲染进程或写入普通日志。

参考：[WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)、[Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/)
