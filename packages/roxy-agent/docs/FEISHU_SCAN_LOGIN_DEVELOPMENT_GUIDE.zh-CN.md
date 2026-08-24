# 飞书/Lark 扫码接入开发文档

> 本文档详述 Reasonix 项目中飞书（Feishu）和 Lark 扫码接入的完整实现，
> 涵盖架构设计、OAuth device-code 流程、配置结构、运行时适配器、消息收发、
> 交互卡片、媒体处理及所有涉及的 API 接口。

---

## 目录

1. [架构概览](#1-架构概览)
2. [扫码连接流程（Device Code OAuth）](#2-扫码连接流程device-code-oauth)
   - [2.1 整体时序](#21-整体时序)
   - [2.2 发起授权（begin）](#22-发起授权begin)
   - [2.3 生成二维码（QR Code）](#23-生成二维码qr-code)
   - [2.4 轮询授权结果（poll）](#24-轮询授权结果poll)
   - [2.5 Lark 租户识别与域名切换](#25-lark-租户识别与域名切换)
   - [2.6 凭据持久化与配置写入](#26-凭据持久化与配置写入)
   - [2.7 运行时刷新](#27-运行时刷新)
3. [配置结构](#3-配置结构)
   - [3.1 FeishuBotConfig](#31-feishubotconfig)
   - [3.2 BotConnectionConfig](#32-botconnectionconfig)
   - [3.3 BotAllowlist](#33-botallowlist)
4. [运行时适配器](#4-运行时适配器)
   - [4.1 适配器接口实现](#41-适配器接口实现)
   - [4.2 WebSocket 长连接模式](#42-websocket-长连接模式)
   - [4.3 Webhook 模式](#43-webhook-模式)
   - [4.4 SDK Client 初始化](#44-sdk-client-初始化)
5. [消息处理](#5-消息处理)
   - [5.1 入站消息解析](#51-入站消息解析)
   - [5.2 @提及门控](#52-提及门控)
   - [5.3 用户名解析](#53-用户名解析)
   - [5.4 出站消息发送](#54-出站消息发送)
   - [5.5 消息编辑（流式输出）](#55-消息编辑流式输出)
   - [5.6 消息去重与幂等](#56-消息去重与幂等)
6. [交互卡片（Interactive Card）](#6-交互卡片interactive-card)
   - [6.1 Markdown 卡片](#61-markdown-卡片)
   - [6.2 审批/问答卡片](#62-审批问答卡片)
   - [6.3 卡片动作回调](#63-卡片动作回调)
7. [媒体文件处理](#7-媒体文件处理)
   - [7.1 入站媒体下载](#71-入站媒体下载)
   - [7.2 出站媒体上传](#72-出站媒体上传)
8. [连接测试与诊断](#8-连接测试与诊断)
9. [涉及的飞书/Lark API 接口汇总](#9-涉及的飞书lark-api-接口汇总)
10. [SDK 依赖与域名对照](#10-sdk-依赖与域名对照)

---

## 1. 架构概览

整个飞书/Lark 接入分为三个层次：

```
┌─────────────────────────────────────────────────┐
│                  桌面端 (Desktop)                 │
│  desktop/bot_connection_app.go                  │
│  · StartBotConnectionInstall()  发起扫码流程     │
│  · PollBotConnectionInstall()   轮询授权结果     │
│  · DiagnoseBotConnection()      连接诊断         │
│  · TestBotConnection()          连接测试         │
└──────────────────┬──────────────────────────────┘
                   │ 读写 config + .env
┌──────────────────▼──────────────────────────────┐
│               配置层 (Config)                     │
│  internal/config/config.go                      │
│  · FeishuBotConfig         飞书 Bot 配置         │
│  · BotConnectionConfig     桌面连接记录          │
│  · BotAllowlist            访问控制白名单        │
└──────────────────┬──────────────────────────────┘
                   │ 注入配置
┌──────────────────▼──────────────────────────────┐
│            运行时适配器 (Adapter)                 │
│  internal/bot/feishu/feishu.go                  │
│  · WebSocket 长连接（默认）                       │
│  · Webhook HTTP 回调                             │
│  · 消息收发 / 交互卡片 / 媒体处理                 │
└─────────────────────────────────────────────────┘
```

关键设计决策：

- **飞书和 Lark 共享 `PlatformFeishu` 平台标识**，通过 `Domain` 字段（`"feishu"` / `"lark"`）区分
- **扫码流程使用飞书官方 Device Code OAuth**（`accounts.feishu.cn` / `accounts.larksuite.com`），无需配置回调 URL
- **运行时默认使用 WebSocket 长连接**（由扫码流程自动配置），也支持 Webhook 模式
- **App Secret 通过环境变量注入**（`FEISHU_BOT_APP_SECRET` / `LARK_BOT_APP_SECRET`），不落盘到配置文件

---

## 2. 扫码连接流程（Device Code OAuth）

扫码连接采用飞书官方「应用注册」OAuth device-code 流程。
用户扫描二维码 → 在飞书/Lark 中授权 → 桌面端轮询获取 App ID 和 App Secret。

### 2.1 整体时序

```
桌面端                        飞书/Lark 账号服务              用户
  │                                │                         │
  │  POST /oauth/v1/app/           │                         │
  │       registration             │                         │
  │  {action:"begin"               │                         │
  │   archetype:"PersonalAgent"    │                         │
  │   auth_method:"client_secret"  │                         │
  │   request_user_info:"open_id"} │                         │
  │───────────────────────────────>│                         │
  │                                │                         │
  │  {device_code,                 │                         │
  │   verification_uri_complete,   │                         │
  │   user_code, interval,         │                         │
  │   expire_in}                   │                         │
  │<───────────────────────────────│                         │
  │                                │                         │
  │  生成二维码 URL                │                         │
  │  (verification_uri_complete    │                         │
  │   + from=sdk&tp=sdk            │                         │
  │   + source=go-sdk)             │                         │
  │                                │                         │
  │                                │  ← 用户扫码并授权       │
  │                                │                         │
  │  ─── 轮询 (每 interval 秒) ──>│                         │
  │  POST /oauth/v1/app/           │                         │
  │       registration             │                         │
  │  {action:"poll",               │                         │
  │   device_code:"..."}           │                         │
  │<───────────────────────────────│                         │
  │  {client_id, client_secret,    │                         │
  │   user_info}                   │                         │
  │                                │                         │
  │  凭据写入 .env + config        │                         │
  │  刷新 Bot 运行时               │                         │
```

### 2.2 发起授权（begin）

**入口函数**：`desktop/bot_connection_app.go` → `StartBotConnectionInstall()` → `startFeishuConnectionInstall()`

**关键代码**（第 444–477 行）：

```go
func (a *App) startFeishuConnectionInstall(domain string) (BotInstallStartResult, error) {
    // 始终从飞书域名开始；Lark 租户会在第一次 poll 响应中识别
    beginDomain := "feishu"
    data, err := postFeishuInstallForm(feishuAccountsBase(beginDomain), map[string]string{
        "action": "begin",
        "archetype": "PersonalAgent",
        "auth_method": "client_secret",
        "request_user_info": "open_id",
    })
    // ...
    deviceCode := stringValue(data["device_code"])
    verifyURL := stringValue(data["verification_uri_complete"])
    userCode := stringValue(data["user_code"])
    // 生成带 SDK 元数据的二维码 URL
    qrURL, err := feishuRegistrationQRCodeURL(verifyURL)
    // 保存安装会话
    a.botInstalls[installID] = &botInstallSession{
        Provider: "feishu", Domain: domain, PollDomain: beginDomain,
        DeviceCode: deviceCode, UserCode: userCode,
        StartedAt: time.Now(), ExpireAt: time.Now().Add(...),
    }
    // 返回给前端：qrURL（二维码 URL）、installID、interval（轮询间隔）、expireIn
}
```

**请求参数说明**：

| 参数 | 值 | 说明 |
|------|-----|------|
| `action` | `"begin"` | 操作类型：开始注册 |
| `archetype` | `"PersonalAgent"` | 应用原型：个人智能体 |
| `auth_method` | `"client_secret"` | 认证方式：客户端密钥 |
| `request_user_info` | `"open_id"` | 请求返回用户的 open_id |

**返回字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `device_code` | string | 设备码，用于后续 poll 请求 |
| `verification_uri_complete` | string | 完整验证 URL（含 user_code），扫码后跳转 |
| `user_code` | string | 用户码（也内嵌在 verification_uri_complete 中） |
| `interval` | int | 轮询间隔（秒），默认 5 |
| `expire_in` | int | 过期时间（秒），默认 300 |

### 2.3 生成二维码（QR Code）

**函数**：`feishuRegistrationQRCodeURL()`（第 665–676 行）

将 `verification_uri_complete` 附加上 SDK 元数据参数，生成最终二维码 URL：

```go
func feishuRegistrationQRCodeURL(rawURL string) (string, error) {
    parsedURL, err := url.Parse(rawURL)
    // ...
    query := parsedURL.Query()
    query.Set("from", "sdk")
    query.Set("tp", "sdk")
    query.Set("source", "go-sdk")
    parsedURL.RawQuery = query.Encode()
    return parsedURL.String(), nil
}
```

**示例**：

- 原始 URL：`https://open.feishu.cn/page/launcher?user_code=ABCD-1234`
- 最终二维码 URL：`https://open.feishu.cn/page/launcher?user_code=ABCD-1234&from=sdk&tp=sdk&source=go-sdk`

### 2.4 轮询授权结果（poll）

**函数**：`pollFeishuConnectionInstall()`（第 480–547 行）

**请求参数**：

| 参数 | 值 | 说明 |
|------|-----|------|
| `action` | `"poll"` | 操作类型：轮询结果 |
| `device_code` | `<device_code>` | 从上一步 begin 返回的设备码 |

**可能的响应状态**：

| 状态 | error 字段 | 行为 |
|------|-----------|------|
| `pending` | `"authorization_pending"` | 用户尚未扫码，继续等待 |
| `pending` | `"slow_down"` | 轮询太快，放慢频率 |
| `pending` | 有 `user_info` 但无 `client_secret` | Lark 域名切换中（见 2.5） |
| `connected` | 有 `client_id` + `client_secret` | 授权完成 |
| `error` | 其他错误 | 终止安装 |

**授权成功返回字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `client_id` | string | 应用的 App ID |
| `client_secret` | string | 应用的 App Secret |
| `user_info.tenant_brand` | string | 租户品牌：`"feishu"` 或 `"lark"` |
| `user_info.open_id` | string | 授权用户的 open_id |
| `user_info.union_id` | string | 授权用户的 union_id（可选） |
| `user_info.user_id` | string | 授权用户的 user_id（可选） |

### 2.5 Lark 租户识别与域名切换

**关键设计**：扫码始终从 `accounts.feishu.cn` 开始。如果第一次 poll 返回的
`user_info.tenant_brand` 为 `"lark"`，则将后续 poll 切换到 `accounts.larksuite.com`。

**函数**：`feishuInstallDomain()`（第 740–751 行）

```go
func feishuInstallDomain(fallback string, data map[string]any) string {
    if userInfo, ok := data["user_info"].(map[string]any); ok {
        if strings.EqualFold(stringValue(userInfo["tenant_brand"]), "lark") {
            return "lark"
        }
        return "feishu"
    }
    // fallback：保持当前域名
    if strings.EqualFold(fallback, "lark") {
        return "lark"
    }
    return "feishu"
}
```

**域名对照**：

| 品牌 | 账户服务域名 | API 域名 | SDK Base URL |
|------|------------|---------|-------------|
| 飞书 | `accounts.feishu.cn` | `open.feishu.cn` | 默认 |
| Lark | `accounts.larksuite.com` | `open.larksuite.com` | `lark.LarkBaseUrl` |

### 2.6 凭据持久化与配置写入

授权成功后，`pollFeishuConnectionInstall()` 执行以下持久化步骤：

**第 1 步：写入 `.env` 文件**

```go
secretEnv := "FEISHU_BOT_APP_SECRET"  // 或 "LARK_BOT_APP_SECRET"
upsertDotEnv(secretEnv, appSecret)
```

**第 2 步：创建 `BotConnectionConfig` 连接记录**

```go
conn := config.BotConnectionConfig{
    ID:         connectionID("feishu", domain),   // "feishu-feishu" 或 "feishu-lark"
    Provider:   "feishu",
    Domain:     domain,                            // "feishu" 或 "lark"
    Label:      "飞书" / "Lark",
    Enabled:    true,
    Status:     "connected",
    Access:     botInstallAccess(userID),          // 将安装者加入 access 白名单
    Credential: config.BotConnectionCredential{
        AppID:        appID,
        AppSecretEnv: secretEnv,
    },
}
```

**第 3 步：更新 legacy 配置（兼容旧版）**

```go
func(c *config.Config) {
    c.Bot.Enabled = true
    c.Bot.Feishu.Enabled = true
    c.Bot.Feishu.Domain = domain
    c.Bot.Feishu.AppID = appID
    c.Bot.Feishu.AppSecretEnv = secretEnv
    c.Bot.Feishu.Mode = "websocket"           // 默认 WebSocket 模式
    c.Bot.Feishu.RequireMention = true        // 默认群聊需要 @
    c.Bot.Allowlist.FeishuUsers = append(..., userID)  // 将安装者加入白名单
}
```

### 2.7 运行时刷新

写入配置后调用 `a.refreshBotRuntimeAsync()` 异步刷新 Bot 运行时，
使新连接立即生效。

---

## 3. 配置结构

### 3.1 FeishuBotConfig

**定义位置**：`internal/config/config.go` 第 621–636 行

```go
type FeishuBotConfig struct {
    Enabled           bool     `toml:"enabled"`
    Domain            string   `toml:"domain"`             // "feishu"（默认）| "lark"
    AppID             string   `toml:"app_id"`
    AppSecretEnv      string   `toml:"app_secret_env"`     // 环境变量名，如 FEISHU_BOT_APP_SECRET
    VerificationToken string   `toml:"verification_token"` // 事件订阅验证 token
    Mode              string   `toml:"mode"`               // "webhook"（默认）| "websocket"
    WebhookPort       int      `toml:"webhook_port"`       // webhook 模式端口，默认 8080
    RequireMention    bool     `toml:"require_mention"`    // 群聊是否必须 @ 机器人
    OutboundMediaRoots []string `toml:"outbound_media_roots"` // 出站媒体文件根目录
}
```

**默认值**（`config.go` 第 1593 行）：

```go
FeishuBotConfig{
    Domain:            "feishu",
    AppSecretEnv:      "FEISHU_BOT_APP_SECRET",
    Mode:              "webhook",
    WebhookPort:       8080,
    RequireMention:    true,
}
```

**TOML 配置示例**：

```toml
[bot.feishu]
enabled = true
domain = "feishu"
app_id = "cli_xxxxxxxxxxxx"
app_secret_env = "FEISHU_BOT_APP_SECRET"
mode = "websocket"
require_mention = true
```

### 3.2 BotConnectionConfig

**定义位置**：`internal/config/config.go` 第 650–666 行

桌面端连接记录，独立于 legacy `[bot.feishu]` 配置，支持多连接管理：

```go
type BotConnectionConfig struct {
    ID               string                        `toml:"id"`      // "feishu-feishu" 或 "feishu-lark"
    Provider         string                        `toml:"provider"` // "feishu"
    Domain           string                        `toml:"domain"`   // "feishu" | "lark"
    Label            string                        `toml:"label"`    // "飞书" | "Lark"
    Enabled          bool                          `toml:"enabled"`
    Status           string                        `toml:"status"`   // "disconnected"|"pending"|"connected"|"error"
    Model            string                        `toml:"model"`
    ToolApprovalMode string                        `toml:"tool_approval_mode"` // "ask"|"auto"|"yolo"
    WorkspaceRoot    string                        `toml:"workspace_root"`
    Access           BotAccessConfig               `toml:"access"`
    Credential       BotConnectionCredential       `toml:"credential"`
    SessionMappings  []BotConnectionSessionMapping `toml:"session_mappings"`
    LastError        string                        `toml:"last_error"`
    CreatedAt        string                        `toml:"created_at"`
    UpdatedAt        string                        `toml:"updated_at"`
}

type BotConnectionCredential struct {
    AppID        string `toml:"app_id"`
    AppSecretEnv string `toml:"app_secret_env"`
    AccountID    string `toml:"account_id"`
    TokenEnv     string `toml:"token_env"`
}

type BotConnectionSessionMapping struct {
    RemoteID      string `toml:"remote_id"`
    SessionID     string `toml:"session_id"`
    SessionSource string `toml:"session_source"`
    ChatType      string `toml:"chat_type"`
    UserID        string `toml:"user_id"`
    ThreadID      string `toml:"thread_id"`
    Scope         string `toml:"scope"`         // "global"|"project"
    WorkspaceRoot string `toml:"workspace_root"`
    UpdatedAt     string `toml:"updated_at"`
}
```

### 3.3 BotAllowlist

**定义位置**：`internal/config/config.go` 第 575–590 行

```go
type BotAllowlist struct {
    Enabled         bool     `toml:"enabled"`
    AllowAll        bool     `toml:"allow_all"`
    QQUsers         []string `toml:"qq_users"`
    FeishuUsers     []string `toml:"feishu_users"`
    WeixinUsers     []string `toml:"weixin_users"`
    QQApprovers     []string `toml:"qq_approvers"`
    FeishuApprovers []string `toml:"feishu_approvers"`
    WeixinApprovers []string `toml:"weixin_approvers"`
    QQAdmins        []string `toml:"qq_admins"`
    FeishuAdmins    []string `toml:"feishu_admins"`
    WeixinAdmins    []string `toml:"weixin_admins"`
    QQGroups        []string `toml:"qq_groups"`
    FeishuGroups    []string `toml:"feishu_groups"`
    WeixinGroups    []string `toml:"weixin_groups"`
}
```

白名单中的用户 ID 使用飞书的 **open_id**。

---

## 4. 运行时适配器

### 4.1 适配器接口实现

**定义位置**：`internal/bot/feishu/feishu.go`，实现 `bot.Adapter` 接口

```go
type adapter struct {
    cfg           config.FeishuBotConfig
    logger        *slog.Logger
    msgCh         chan bot.InboundMessage
    cancel        context.CancelFunc
    client        *lark.Client         // SDK 客户端（懒初始化）
    wsClient      *larkws.Client       // WebSocket 客户端
    fetchResource func(...)            // 资源下载（可注入测试）
    clientMu      sync.Mutex
    seenMu        sync.Mutex
    seen          map[string]bool      // 消息去重
    botMu         sync.Mutex
    botID         string               // bot 自身的 open_id
    nameMu        sync.Mutex
    names         map[string]nameCacheEntry  // open_id → 显示名缓存
}
```

**接口方法**：

| 方法 | 说明 |
|------|------|
| `Platform() bot.Platform` | 返回 `PlatformFeishu` |
| `Name() string` | 返回 `"feishu"` |
| `Start(ctx)` | 启动适配器（WebSocket 或 Webhook） |
| `Stop()` | 优雅关闭 |
| `Send(ctx, msg)` | 发送出站消息 |
| `SendTyping(ctx, chatID)` | 发送"正在输入"状态（飞书无操作） |
| `Messages() <-chan bot.InboundMessage` | 入站消息通道 |

### 4.2 WebSocket 长连接模式

**入口函数**：`runWebSocket()`（第 286–322 行）

使用飞书 SDK 的 `larkws.Client` 建立长连接，接收事件推送：

```go
func (a *adapter) runWebSocket(ctx context.Context) {
    secret, _ := a.appSecret()
    eventHandler := a.newEventDispatcher()
    // 带重连的 WebSocket 客户端
    client := larkws.NewClient(a.cfg.AppID, secret,
        larkws.WithEventHandler(eventHandler),
        larkws.WithLogLevel(larkcore.LogLevelError),
        larkws.WithAutoReconnect(true),
        larkws.WithOnReady(func() { ... }),
        larkws.WithOnReconnecting(func() { ... }),
        larkws.WithOnReconnected(func() { ... }),
        larkws.WithOnError(func(err error) { ... }),
    )
    a.wsClient = client
    client.Start(ctx)
}
```

**事件分发器**（`newEventDispatcher()`，第 324–346 行）：

注册了以下事件处理：

| SDK 事件 | 处理函数 | 说明 |
|---------|---------|------|
| `OnP2MessageReceiveV1` | `handleSDKMessage` | 接收消息 |
| `OnP2MessageReadV1` | 空操作 | 消息已读 |
| `OnP2MessageReactionCreatedV1` | 空操作 | Reaction 添加 |
| `OnP2MessageReactionDeletedV1` | 空操作 | Reaction 移除 |
| `OnP2CardActionTrigger` | `handleCardAction` | 交互卡片按钮点击 |

### 4.3 Webhook 模式

**入口函数**：`runWebhook()`（第 947–1011 行）

暴露 HTTP 端点 `POST /feishu/event`，处理飞书事件推送：

**URL 验证（Challenge）**：

```go
if challenge.Type == "url_verification" {
    if !a.verificationTokenValid(challenge.Token) {
        http.Error(w, "forbidden", http.StatusForbidden)
        return
    }
    // 返回 challenge 值以通过验证
    json.NewEncoder(w).Encode(map[string]string{"challenge": challenge.Challenge})
    return
}
```

**事件处理**：

```go
var evt feishuEvent
json.Unmarshal(body, &evt)
if !a.verificationTokenValid(evt.Header.Token) {
    http.Error(w, "forbidden", http.StatusForbidden)
    return
}
// 优先处理卡片动作，否则作为普通消息事件
if !a.handleCardAction(body) {
    a.handleWSEvent(ctx, raw)
}
w.WriteHeader(200)
```

**安全设计**：Webhook 模式必须配置 `verification_token`，空 token 将直接拒绝所有请求（fail-closed）。

### 4.4 SDK Client 初始化

**函数**：`sdkClient()`（第 728–748 行）

懒初始化（首次使用时构建），线程安全：

```go
func (a *adapter) sdkClient() (*lark.Client, error) {
    a.clientMu.Lock()
    defer a.clientMu.Unlock()
    if a.client != nil {
        return a.client, nil
    }
    secret, err := a.appSecret()  // 从环境变量读取
    // ...
    opts := []lark.ClientOptionFunc{
        lark.WithLogLevel(larkcore.LogLevelError),
        lark.WithReqTimeout(15 * time.Second),
        lark.WithSource("reasonix"),
    }
    if feishuDomain(a.cfg.Domain) == "lark" {
        opts = append(opts,
            lark.WithOpenBaseUrl(lark.LarkBaseUrl),
            lark.WithOAuthBaseUrl(lark.OAuthBaseUrlLark),
        )
    }
    a.client = lark.NewClient(a.cfg.AppID, secret, opts...)
    return a.client, nil
}
```

**App Secret 读取**（第 277–283 行）：

```go
func (a *adapter) appSecret() (string, error) {
    secret := os.Getenv(a.cfg.AppSecretEnv)
    if a.cfg.AppID == "" || secret == "" {
        return "", fmt.Errorf("feishu app_id or %s is not configured", a.cfg.AppSecretEnv)
    }
    return secret, nil
}
```

---

## 5. 消息处理

### 5.1 入站消息解析

**函数**：`parseInboundContent()`（`internal/bot/feishu/inbound.go` 第 86–118 行）

支持的消息类型：

| msg_type | 解析方式 | 说明 |
|----------|---------|------|
| `text` | 直接提取 `text` 字段 | 纯文本消息 |
| `image` | 创建延迟下载 Loader | 图片，通过 `Im.MessageResource.Get` 下载 |
| `sticker` | 创建延迟下载 Loader（type=image） | 贴纸，按图片处理 |
| `file` | 创建延迟下载 Loader | 文件，保留文件名 |
| `post` | `parsePostContent()` | 富文本，解析段落、链接、@、图片 |
| 其他 | 返回 false | 不支持的类型会被忽略 |

**富文本（post）解析**（`parsePostContent()`，第 121–172 行）：

支持的富文本标签：

| tag | 处理方式 | 输出 |
|-----|---------|------|
| `text`, `code_block`, `md` | 拼接文本 | 原文 |
| `a` | 链接 | `文本 (URL)` 或直接 URL |
| `at` | @提及 | `@用户名` |
| `img` | 创建延迟下载 | `[图片下载失败]`（下载失败时） |
| `media` | 占位 | `[视频]` |

**延迟媒体下载**（`deferredMedia()`，第 174–194 行）：

媒体文件不会在解析时立即下载，而是创建 `Load` 回调，在网关白名单放行发送者后才执行下载。

```go
func (a *adapter) deferredMedia(messageID, key, typ, name, failureText string) bot.InboundMedia {
    return bot.InboundMedia{
        Name:        name,
        FailureText: failureText,
        Load: func(ctx context.Context) ([]byte, string, error) {
            // 通过 SDK 下载资源
            return a.sdkFetchResource(ctx, messageID, key, typ)
        },
    }
}
```

### 5.2 @提及门控

群聊中，通过 `require_mention` 配置和 `mentionsBot()` 函数实现 @门控：

```go
func (a *adapter) mentionsBot(mentions []mentionRef) bool {
    botID := a.botOpenID()
    if botID == "" {
        return len(mentions) > 0  // bot open_id 未知时，任意 @ 放行
    }
    for _, m := range mentions {
        if m.OpenID != "" && m.OpenID == botID {
            return true
        }
    }
    return false
}
```

**Bot OpenID 获取**（`fetchBotOpenID()`，第 178–204 行）：

启动时异步调用 `GET /open-apis/bot/v3/info` 获取 bot 自身的 open_id，
失败则降级为"任意 @ 放行"。

**@占位符替换**（`replaceMentionPlaceholders()`，第 69–82 行）：

将飞书消息中的 `@_user_N` 占位符替换为 `@显示名`，bot 自身的 @ 直接移除。

### 5.3 用户名解析

**函数**：`resolveUserName()`（第 208–231 行）

通过飞书通讯录 API 将 `open_id` 解析为显示名，支持 1 小时缓存：

```go
func (a *adapter) lookupUserName(ctx context.Context, openID string) (string, time.Duration) {
    req := larkcontact.NewGetUserReqBuilder().
        UserId(openID).
        UserIdType(larkcontact.UserIdTypeOpenId).
        Build()
    resp, err := client.Contact.User.Get(ctx, req)
    // ...
    return name, userNameCacheTTL  // 成功缓存 1 小时
    return openID, userNameFallbackCacheTTL  // 失败缓存 5 分钟
}
```

### 5.4 出站消息发送

**函数**：`sendMessage()` → `sendRenderedText()` → `sendSDKContent()`（第 629–804 行）

**消息格式策略**：

1. **Interactive Card（默认）**：以 JSON 2.0 Interactive Card 发送，内嵌 markdown 元素
2. **纯文本降级**：卡片超过 30KB 限制（错误码 11310/11325）时自动降级为 `text` 消息
3. **引用回复**：有 `ReplyToMsgID` 时优先使用 `Im.Message.Reply`；若消息已被撤回（错误码 230011）则回退 `Im.Message.Create`

**Interactive Card 结构**（`buildMarkdownCard()`，第 668–692 行）：

```json
{
  "schema": "2.0",
  "config": {
    "update_multi": true
  },
  "body": {
    "elements": [
      {
        "tag": "markdown",
        "content": "<Markdown 文本>"
      }
    ]
  }
}
```

关键设计：`"update_multi": true` 使卡片可被 `Im.Message.Patch` 更新（用于流式输出）。

**消息发送**（`sendSDKContent()`，第 750–804 行）：

```go
func (a *adapter) sendSDKContent(ctx context.Context, msg bot.OutboundMessage, msgType, content string) (bot.SendResult, error) {
    // 幂等 key：跨重试稳定，避免重复发送
    uuid := newIdempotencyKey()
    body := larkim.NewCreateMessageReqBodyBuilder().
        ReceiveId(chatID).
        MsgType(msgType).
        Content(content).
        Uuid(uuid).
        Build()
    req := larkim.NewCreateMessageReqBuilder().
        ReceiveIdType(larkim.CreateMessageV1ReceiveIDTypeChatId).
        Body(body).
        Build()
    resp, err := client.Im.Message.Create(ctx, req)
    // ...
}
```

### 5.5 消息编辑（流式输出）

**函数**：`EditMessage()`（`internal/bot/feishu/outbound.go` 第 15–45 行）

通过 `Im.Message.Patch` 原地编辑已发送的 Interactive Card 消息，实现流式输出：

```go
func (a *adapter) EditMessage(ctx context.Context, messageID string, msg bot.OutboundMessage) error {
    content, _ := buildMarkdownCard(msg.Text)
    req := larkim.NewPatchMessageReqBuilder().
        MessageId(messageID).
        Body(larkim.NewPatchMessageReqBodyBuilder().Content(content).Build()).
        Build()
    resp, err := client.Im.Message.Patch(ctx, req)
    // ...
}
```

### 5.6 消息去重与幂等

**消息去重**（`markSeen()`）：基于 `event_id` 去重，使用内存 map。

**发送幂等**（`newIdempotencyKey()`，`internal/bot/feishu/retry.go` 第 24–30 行）：

```go
func newIdempotencyKey() string {
    var b [16]byte
    rand.Read(b[:])
    return hex.EncodeToString(b[:])
}
```

生成的随机 UUID 通过 `Uuid()` 字段传给飞书 API。飞书基于此字段去重，
确保在网络超时重试时不会产生重复消息。

**瞬时错误重试**（`withTransientRetry()`，第 42–59 行）：

对 connection reset、broken pipe、I/O timeout 等传输层错误进行最多 3 次指数退避重试。
飞书 API 层面的错误（限流、大小限制、权限）不重试。

---

## 6. 交互卡片（Interactive Card）

### 6.1 Markdown 卡片

所有文本回复默认以 Interactive Card 发送，卡片正文使用 `markdown` 标签，
支持 CommonMark 标准语法。

### 6.2 审批/问答卡片

**函数**：`sendCard()`（`feishu.go` 第 888–919 行）

发送带交互按钮的卡片：

```go
func (a *adapter) sendCard(ctx context.Context, msg bot.OutboundMessage) (bot.SendResult, error) {
    cardPayload := map[string]interface{}{
        "header": map[string]interface{}{
            "title": map[string]string{
                "tag":     "plain_text",
                "content": card.Header,
            },
        },
        "elements": elements,
    }
    return a.sendSDKContent(ctx, msg, larkim.MsgTypeInteractive, string(cardJSON))
}
```

### 6.3 卡片动作回调

**函数**：`handleCardAction()`（第 339–345 行）

```go
OnP2CardActionTrigger(func(ctx context.Context, event *callback.CardActionTriggerEvent) (*callback.CardActionTriggerResponse, error) {
    if !a.handleCardAction(event.Body) {
        return cardActionToast("warning", "操作无效或已过期"), nil
    }
    return cardActionToast("success", "操作已提交"), nil
})
```

处理审批/问答按钮点击，返回 toast 提示。

**Reaction 表情**（`AddPendingReaction()`，第 843–885 行）：

通过 `Im.MessageReaction.Create` 添加 `OnIt` 表情作为"处理中"指示器，
完成后通过 `Im.MessageReaction.Delete` 移除。

---

## 7. 媒体文件处理

### 7.1 入站媒体下载

**函数**：`sdkFetchResource()`（`inbound.go` 第 197–233 行）

```go
func (a *adapter) sdkFetchResource(ctx context.Context, messageID, key, typ string) ([]byte, string, error) {
    req := larkim.NewGetMessageResourceReqBuilder().
        MessageId(messageID).
        FileKey(key).
        Type(typ).    // "image" 或 "file"
        Build()
    resp, err := client.Im.MessageResource.Get(ctx, req)
    // 限制最大 25 MB
    raw, _ := io.ReadAll(io.LimitReader(resp.File, maxFeishuMediaBytes+1))
    if len(raw) > maxFeishuMediaBytes {
        return nil, "", fmt.Errorf("must be between 1 byte and 25 MB")
    }
    return raw, resp.FileName, nil
}
```

### 7.2 出站媒体上传

**文件位置**：`internal/bot/feishu/outbound_media.go`

**图片上传**（`uploadImage()`，第 159–189 行）：

```go
req := larkim.NewCreateImageReqBuilder().
    Body(larkim.NewCreateImageReqBodyBuilder().
        ImageType(larkim.CreateImageImageTypeMessage).
        Image(bytes.NewReader(data)).
        Build()).
    Build()
resp, err := client.Im.Image.Create(ctx, req)
```

**文件上传**（`uploadFile()`，第 191–225 行）：

```go
req := larkim.NewCreateFileReqBuilder().
    Body(larkim.NewCreateFileReqBodyBuilder().
        FileType(feishuFileType(name)).   // pdf/doc/xls/ppt/mp4/opus/stream
        FileName(name).
        File(bytes.NewReader(data)).
        Build()).
    Build()
resp, err := client.Im.File.Create(ctx, req)
```

**文件类型映射**（`feishuFileType()`，第 227–243 行）：

| 扩展名 | 飞书类型 |
|--------|---------|
| `.pdf` | `pdf` |
| `.doc`, `.docx` | `doc` |
| `.xls`, `.xlsx` | `xls` |
| `.ppt`, `.pptx` | `ppt` |
| `.mp4` | `mp4` |
| `.opus` | `opus` |
| 其他 | `stream` |

**安全设计**：

- 文件必须位于配置的 `OutboundMediaRoots` 目录下
- 使用 `os.Root` (Go 1.24+) 防止符号链接逃逸
- 文件名必须是裸文件名（不允许路径分隔符）
- 大小限制 25 MB

---

## 8. 连接测试与诊断

**函数位置**：`desktop/bot_connection_app.go`

### 连接诊断（`DiagnoseBotConnection`）

检查 Bot 连接的配置状态：

| 检查项 | code | 严重级别 |
|--------|------|---------|
| 连接未启用 | `connection_disabled` | disabled |
| 状态非 connected | `connection_not_connected` | pending/error |
| 密钥未设置 | `secret_missing` | warning |
| 一切正常 | `config_ok` | ok |

### 连接测试（`TestBotConnection`）

通过 `feishu.SendText()` 发送测试消息到指定 Chat ID：

```go
result, err = feishu.SendText(ctx, feishuCfg, target, "Reasonix bot 测试消息：连接和发送链路可用。")
```

---

## 9. 涉及的飞书/Lark API 接口汇总

### 扫码安装相关（Device Code OAuth）

| API | Method | URL | 认证 | 说明 |
|-----|--------|-----|------|------|
| 发起注册 | POST | `https://accounts.feishu.cn/oauth/v1/app/registration` | 无 | 发起 PersonalAgent 注册，获取 device_code |
| 发起注册 (Lark) | POST | `https://accounts.larksuite.com/oauth/v1/app/registration` | 无 | 同上，Lark 域名 |
| 轮询结果 | POST | 同上 | 无 | action=poll，携带 device_code |
| 扫码授权页 | GET | `https://open.feishu.cn/page/launcher?user_code=...` | 用户 token | 用户在飞书中扫码后跳转 |

### 运行时 API（通过 SDK）

| API | SDK 方法 | 认证类型 | 说明 |
|-----|---------|---------|------|
| WebSocket 连接 | `larkws.Client.Start()` | App Access Token | 接收事件推送 |
| 获取 Bot 信息 | `GET /open-apis/bot/v3/info` | Tenant Access Token | 获取 bot 自身 open_id |
| 发送消息 | `Im.Message.Create` | Tenant Access Token | 发送文本/卡片/图片/文件 |
| 回复消息 | `Im.Message.Reply` | Tenant Access Token | 引用回复 |
| 编辑消息 | `Im.Message.Patch` | Tenant Access Token | 更新 Interactive Card（流式输出） |
| 获取消息资源 | `Im.MessageResource.Get` | Tenant Access Token | 下载图片/文件 |
| 上传图片 | `Im.Image.Create` | Tenant Access Token | 上传待发送图片 |
| 上传文件 | `Im.File.Create` | Tenant Access Token | 上传待发送文件 |
| 获取用户信息 | `Contact.User.Get` | Tenant Access Token | open_id → 显示名 |
| 添加 Reaction | `Im.MessageReaction.Create` | Tenant Access Token | 添加"处理中"表情 |
| 删除 Reaction | `Im.MessageReaction.Delete` | Tenant Access Token | 移除 Reaction |

### 事件订阅类型

| 事件类型 | 触发场景 | 处理方式 |
|---------|---------|---------|
| `im.message.receive_v1` | 收到消息 | 解析并路由到消息通道 |
| `im.message.read_v1` | 消息已读 | 忽略 |
| `im.message.reaction.created_v1` | 添加 Reaction | 忽略 |
| `im.message.reaction.deleted_v1` | 移除 Reaction | 忽略 |
| `card.action.trigger` | 点击卡片按钮 | 处理审批/问答动作 |

### 错误码处理

| 错误码 | 含义 | 处理策略 |
|--------|------|---------|
| 11310 | 卡片过大 | 降级为纯文本 |
| 11325 | 内容过大 | 降级为纯文本 |
| 230011 | 消息已撤回 | 回退为非回复发送 |
| authorization_pending | 用户未扫码 | 继续等待 |
| slow_down | 轮询过快 | 放慢频率 |

---

## 10. SDK 依赖与域名对照

### SDK 依赖

```go
// go.mod
github.com/larksuite/oapi-sdk-go/v3
```

使用的 SDK 子包：

| 导入路径 | 用途 |
|---------|------|
| `github.com/larksuite/oapi-sdk-go/v3` | 核心 client (`lark.NewClient`) |
| `github.com/larksuite/oapi-sdk-go/v3/core` | 日志级别、Token 类型 |
| `github.com/larksuite/oapi-sdk-go/v3/event/dispatcher` | 事件分发器 |
| `github.com/larksuite/oapi-sdk-go/v3/event/dispatcher/callback` | 卡片动作回调 |
| `github.com/larksuite/oapi-sdk-go/v3/service/contact/v3` | 通讯录 API |
| `github.com/larksuite/oapi-sdk-go/v3/service/im/v1` | 消息 API |
| `github.com/larksuite/oapi-sdk-go/v3/ws` | WebSocket 客户端 |

### 域名对照表

| 用途 | 飞书 (Feishu) | Lark |
|------|-------------|------|
| 账户服务 | `accounts.feishu.cn` | `accounts.larksuite.com` |
| Open API | `open.feishu.cn` | `open.larksuite.com` |
| SDK Base URL | 默认 | `lark.LarkBaseUrl` |
| OAuth Base URL | 默认 | `lark.OAuthBaseUrlLark` |
| 扫码启动页 | `open.feishu.cn/page/launcher` | `open.larksuite.com/page/launcher` |

### 关键文件清单

| 文件 | 职责 |
|------|------|
| `desktop/bot_connection_app.go` | 桌面端扫码安装流程 |
| `desktop/bot_connection_app_test.go` | 安装流程测试 |
| `internal/bot/feishu/feishu.go` | 适配器主体（WebSocket/Webhook/消息/卡片） |
| `internal/bot/feishu/inbound.go` | 入站消息解析、媒体下载 |
| `internal/bot/feishu/outbound.go` | 消息编辑（流式输出） |
| `internal/bot/feishu/outbound_media.go` | 出站媒体上传 |
| `internal/bot/feishu/retry.go` | 幂等 key 生成、瞬时错误重试 |
| `internal/config/config.go` | FeishuBotConfig、BotConnectionConfig 配置结构 |
| `internal/config/credentials.go` | 凭据环境变量管理 |
| `internal/bot/types.go` | Platform、InboundMessage、OutboundMessage、Adapter 接口 |
| `internal/botruntime/runtime.go` | 适配器绑定、域名过滤 |
| `docs/BOT_GUIDE.zh-CN.md` | 用户使用指南 |
