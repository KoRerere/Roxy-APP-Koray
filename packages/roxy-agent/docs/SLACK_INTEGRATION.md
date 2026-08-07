# Slack 接入指南（完整配置流程）

本文档介绍如何将 Roxy Agent 接入 Slack 平台，包含完整的配置步骤和常见问题解决。

## 一、前置条件

- 一个 Slack 工作区（Workspace），你需要有该工作区的管理员权限
- 已部署好的 Roxy Agent 服务

## 二、快速配置流程（推荐按顺序操作）

### 步骤 1: 创建 Slack App

1. 访问 [Slack API 网站](https://api.slack.com/apps)
2. 点击 **"Create New App"** 按钮
3. 选择 **"From scratch"** 选项
4. 填写 App 名称（例如：Roxy Agent），选择要部署到的工作区
5. 点击 **"Create App"**

### 步骤 2: 启用 App Home（私信功能）

**必须先配置这个，否则无法发送私信！**

1. 在 App 管理页面，左侧菜单选择 **"App Home"**
2. 滚动到 **"Show Tabs"** 部分
3. 找到 **"Messages Tab"**，开启 **"Allow users to send Slash commands and messages from the messages tab"**
4. （可选）在 **"Your App's Presence in Slack"** 部分，可以设置 App 的头像、描述等

### 步骤 3: 配置 Bot Token Scopes（权限）

#### 个人私用（最小权限）

如果你只是自己用，只需要这 3 个权限：

1. 左侧菜单选择 **"OAuth & Permissions"**
2. 滚动到 **"Scopes"** → **"Bot Token Scopes"**
3. 点击 **"Add an OAuth Scope"**，添加：
   - `chat:write` - **必需** - 发送消息
   - `im:history` - **必需** - 读取私信消息
   - `im:read` - **必需** - 读取私信信息

#### 如需在频道中使用（额外添加）

如果需要把 Bot 拉到频道里 @它使用，需要额外添加：

- `app_mentions:read` - 读取 @提及
- `channels:history` - 读取公共频道消息
- `channels:read` - 读取公共频道信息
- `groups:history` - 读取私有群组消息
- `groups:read` - 读取私有群组信息

#### 如需识别图片（可选）

- `files:read` - 读取文件/图片

#### 如需用户白名单（可选）

- `users:read` - 读取用户信息

### 步骤 4: 安装 App 到工作区

**配置完权限后必须安装！**

1. 在 **"OAuth & Permissions"** 页面顶部
2. 点击 **"Install to Workspace"**（或 **"Reinstall to Workspace"**）
3. 在授权页面点击 **"允许"**
4. 安装成功后，你会看到 **"Bot User OAuth Token"**，格式为 `xoxb-...`
5. **复制保存这个 Token**，这就是 `SLACK_BOT_TOKEN`

### 步骤 5: 获取 Signing Secret

1. 左侧菜单选择 **"Basic Information"**
2. 滚动到 **"App Credentials"** 部分
3. 找到 **"Signing Secret"**，点击 **"Show"** 显示
4. **复制保存这个 Secret**，这就是 `SLACK_SIGNING_SECRET`

### 步骤 6: （推荐）配置 Socket Mode（内网部署）

如果你的 Roxy Agent 部署在内网，建议使用 Socket Mode：

1. 左侧菜单选择 **"Socket Mode"**
2. 开启 **"Enable Socket Mode"**
3. 点击 **"Generate Token"**，输入 Token 名称（例如：Roxy Agent Socket）
4. 点击 **"Generate"**，会显示一个 Token，格式为 `xapp-...`
5. **复制保存这个 Token**，这就是 `SLACK_APP_TOKEN`

### 步骤 7: 配置事件订阅

#### 如果使用 Socket Mode（推荐）：

1. 左侧菜单选择 **"Event Subscriptions"**
2. 开启 **"Enable Events"**
3. 滚动到 **"Subscribe to bot events"**，点击 **"Add Bot User Event"**
4. 添加以下事件：
   - `message.im` - 私信消息
   - （如果用在频道）`app_mention` - @提及
   - （如果用在频道）`message.channels` - 频道消息
   - （如果用在群组）`message.groups` - 群组消息
5. 点击 **"Save Changes"**

#### 如果使用 HTTP 模式（需要公网地址）：

1. 左侧菜单选择 **"Event Subscriptions"**
2. 开启 **"Enable Events"**
3. 在 **"Request URL"** 中填入你的公网地址
4. 其余步骤同 Socket Mode

### 步骤 8: 重新安装 App（重要！）

**每次修改权限或事件订阅后，都必须重新安装！**

1. 左侧菜单选择 **"OAuth & Permissions"**
2. 点击 **"Reinstall to Workspace"**
3. 点击 **"允许"**

## 三、配置 RoxyClaw

在 RoxyClaw 配置中启用 Slack，并填写以下内容：

```bash
# ========== Slack 配置 ==========
# Bot User OAuth Token（从 OAuth & Permissions 页面获取）
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx

# Signing Secret（从 Basic Information 页面获取）
SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# （可选，推荐）App Token for Socket Mode（从 Socket Mode 页面获取）
SLACK_APP_TOKEN=xapp-1-xxxxxxxxxxxx-xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# （可选）允许的用户 ID 白名单，逗号分隔，留空表示允许所有用户
SLACK_ALLOWED_USER_IDS=U0123456789,U9876543210

# （可选）允许的频道 ID 白名单，逗号分隔，留空表示允许所有频道
SLACK_ALLOWED_CHANNEL_IDS=C0123456789,C9876543210
```

## 四、获取用户 ID 和频道 ID（用于白名单）

### 获取用户 ID：

1. 在 Slack 中点击任意用户的头像
2. 点击用户名称旁边的 **"..."** 菜单
3. 选择 **"复制成员 ID"**

### 获取频道 ID：

1. 在 Slack 中打开任意频道
2. 点击频道名称顶部的下拉箭头
3. 滚动到底部，可以看到 **"频道 ID"**
4. 点击复制

## 五、启动服务

配置完成后，Electron 会在后台按 RoxyClaw 的 `enabled` 配置启动同一个 agent 进程内的 IM 能力。如果配置正确，你会在日志中看到：

```
[IM] Checking Slack config: BOT_TOKEN=set, SIGNING_SECRET=set
[Slack] Creating Slack app with proxy support...
[Slack] Starting Slack app with proxy support...
[INFO]  socket-mode:SocketModeClient:0 Going to establish a new connection to Slack ...
[Slack] Slack app started successfully!
[IM] Slack adapter started.
[IM] IM service running with 1 platform(s).
```

## 六、使用方法

### 基本对话

1. 在 Slack 左侧找到 **"Apps"** → **"Add apps"**
2. 找到你的 Bot（Roxy Agent）并添加
3. 直接给 Bot 发消息即可开始对话
4. Bot 会自动回复

### 在频道中使用

1. 将 Bot 添加到频道
2. @Bot 加上消息，例如：`@Roxy Agent 你好`

### 可用命令

- `/new` - 创建新对话（清空历史上下文）
- `/clear` - 清空对话历史
- `/status` - 查看当前对话状态

## 七、常见问题

### Q: 提示 "Sending messages to this app has been turned off."

A: 这是因为没有启用 App Home 的 Messages Tab，请按以下步骤修复：

1. 前往 **App Home** 页面
2. 开启 **"Allow users to send Slash commands and messages from the messages tab"**
3. 前往 **OAuth & Permissions** 页面
4. 点击 **"Reinstall to Workspace"** 重新安装

### Q: Bot 不回复消息？

A: 请检查：
1. Bot 是否已添加到私信对话
2. 权限是否配置正确（至少需要 `chat:write`、`im:history`、`im:read`）
3. 环境变量是否正确设置
4. 查看服务日志是否有错误
5. 是否重新安装了 App（修改权限后必须重新安装）

### Q: 提示 "未授权访问"？

A: 你配置了 `SLACK_ALLOWED_USER_IDS` 或 `SLACK_ALLOWED_CHANNEL_IDS`，但当前用户或频道不在白名单中。请添加你的用户 ID 或频道 ID 到白名单，或清空白名单配置以允许所有访问。

### Q: Socket Mode 有什么优势？

A: Socket Mode 不需要公网 IP 和反向代理，适合内网部署。通过 WebSocket 连接到 Slack 服务器，更安全且易于部署。

### Q: 修改权限后不生效？

A: 每次修改 **Scopes** 或 **Event Subscriptions** 后，都必须前往 **OAuth & Permissions** 页面点击 **"Reinstall to Workspace"** 重新安装 App。

## 八、快速检查清单

配置完成后，用这个清单检查：

- [ ] App 已创建
- [ ] App Home → Messages Tab 已开启
- [ ] Bot Token Scopes 已配置（至少 3 个）
- [ ] Event Subscriptions 已配置
- [ ] App 已安装/重新安装到工作区
- [ ] `SLACK_BOT_TOKEN` 已获取
- [ ] `SLACK_SIGNING_SECRET` 已获取
- [ ] （可选）`SLACK_APP_TOKEN` 已获取
- [ ] 环境变量已配置
- [ ] Roxy Agent 已启动
- [ ] Bot 已添加到 Slack 的 Apps 中
