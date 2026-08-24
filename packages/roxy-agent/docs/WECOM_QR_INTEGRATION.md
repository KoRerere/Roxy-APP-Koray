# 企业微信扫码接入

## 先确定产品形态

企业微信有三种接入方式，扫码含义不同：

| 方式 | 适用场景 | 扫码作用 |
| --- | --- | --- |
| 自建内部应用 | Agent 服务一个企业内部成员 | 成员登录网页、打开应用或完成授权 |
| 第三方服务商应用 | Roxy 作为 SaaS 给多个企业安装 | 企业管理员扫码授权应用 |
| 群机器人 Webhook | 只发通知 | 通常不需要扫码，使用 Webhook Key |

## 自建内部应用

1. 管理员在企业微信管理后台创建自建应用。
2. 配置可见范围、接收消息服务器 URL、Token、EncodingAESKey。
3. 成员扫码登录网页或扫描应用入口二维码。
4. 服务端使用 `CorpID + CorpSecret` 获取企业级 `access_token`。
5. 企业微信将消息回调到 Agent，Agent 使用消息发送接口回复。

二维码只解决成员授权或打开应用，不会为每个成员生成永久 Bot Token。`access_token` 必须服务端缓存并按过期时间刷新。

## 第三方服务商应用

适用于 Roxy Agent 服务多个企业：

1. 服务商创建第三方应用，准备 `SuiteID`、`SuiteSecret` 并接收 `suite_ticket`。
2. 生成企业管理员扫码授权 URL。
3. 管理员扫码、选择企业并授权。
4. 服务端用 `auth_code` 换取企业永久授权信息。
5. 按租户保存授权信息，处理消息回调和授权变更。

不要让租户把 `CorpSecret` 直接填入 Electron 客户端，也不要把企业微信凭证复用为微信 iLink 的 `botToken`。

## 群机器人 Webhook

群机器人适合通知场景：服务端使用 Webhook Key 发送文本、Markdown 或卡片。它不能替代完整应用，通常无法接收所有私聊和群消息。

## Roxy Agent 实现建议

新增独立目录 `src/im/wecom/`，不要复用 `src/im/weixin/`：

- `callback.ts`：签名校验、URL 验证、XML 解密/加密、事件解析；
- `adapter.ts`：消息归一化和发送消息；
- `token.ts`：企业级或租户级 `access_token` 缓存；
- `install.ts`：授权二维码、`auth_code` 交换和租户绑定。

建议凭证字段：

```text
corpId, corpSecret, agentId,
callbackToken, encodingAesKey,
suiteId, suiteSecret, permanentCode
```

回调必须使用公网 HTTPS。所有授权 state、临时 code 要短时有效并绑定 workspace。

参考：[企业微信开发者中心](https://developer.work.weixin.qq.com/)
