# Discord 接入指南（个人使用）

本文档介绍如何将 Roxy Agent 接入 Discord 平台，仅用于个人私用。

## 一、前置条件

- 一个 Discord 账号
- 已部署好的 Roxy Agent 服务

## 二、配置流程

### 步骤 1: 创建 Discord Application

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 点击右上角 **"New Application"** 按钮
3. 输入名称（例如：Roxy Agent），点击 **"Create"**

### 步骤 2: 配置 Bot

1. 左侧菜单选择 **"Bot"**
2. 点击 **"Add Bot"** → 点击 **"Yes, do it!"** 确认
3. （可选）点击 Bot 头像旁边的 **"Reset Avatar"** 可以设置头像
4. （可选）修改 **Username** 为你喜欢的名字

### 步骤 3: 获取 Bot Token

1. 在 **Bot** 页面，点击 **"Reset Token"** 按钮
2. 点击 **"Yes, do it!"** 确认
3. 复制显示的 Token（格式类似 `MTIz...`）
4. **保存好这个 Token**，这就是 `DISCORD_BOT_TOKEN`

**注意：** Token 只显示一次，如果忘记了需要重新点击 "Reset Token"。

### 步骤 4: 配置 Privileged Gateway Intents

在 **Bot** 页面往下滚动，找到 **"Privileged Gateway Intents"** 部分：

开启以下三个开关：
- ✅ **Presence Intent**
- ✅ **Server Members Intent**
- ✅ **Message Content Intent**

这三个都要开，否则 Bot 收不到消息！

### 步骤 5: 获取 Invite URL（邀请 Bot 进服务器）

1. 左侧菜单选择 **"OAuth2"** → **"URL Generator"**
2. 在 **"SCOPES"** 部分，勾选：
   - ✅ **bot**
3. 在 **"BOT PERMISSIONS"** 部分，勾选：
   - ✅ **Send Messages** - 发送消息
   - ✅ **Read Message History** - 读取消息历史
   - ✅ **Read Messages/View Channels** - 查看频道
   - ✅ **Attach Files** - （可选）发送文件
   - ✅ **Embed Links** - （可选）嵌入链接
4. 复制页面底部的 **"Generated URL"**
5. 在浏览器中打开这个 URL
6. 选择你的服务器，点击 **"继续"**
7. 点击 **"授权"**，完成人机验证

### 步骤 6: 获取你的用户 ID（用于白名单）

为了安全，建议配置只允许你自己使用：

1. 打开 Discord 桌面/网页版
2. 点击左下角用户设置（齿轮图标）
3. 左侧选择 **"高级"**
4. 开启 **"开发者模式"**
5. 返回聊天界面，右键点击你自己的头像
6. 选择 **"复制用户 ID"**
7. 保存这个 ID（一串数字，例如 `123456789012345678`）

### 步骤 7: （可选）获取频道/服务器 ID

如果你想限制 Bot 只能在特定频道使用：

- **获取频道 ID**: 右键点击频道名称 → **"复制频道 ID"**
- **获取服务器 ID**: 右键点击服务器图标 → **"复制服务器 ID"**

## 三、配置 RoxyClaw

在 RoxyClaw 配置中启用 Discord，并填写以下内容：

```bash
# ========== Discord 配置 ==========
# Bot Token（从 Bot 页面获取）
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4.GhijKl.MnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx

# （推荐）允许的用户 ID 白名单，只允许你自己使用
DISCORD_ALLOWED_USER_IDS=123456789012345678

# （可选）允许的频道 ID 白名单，逗号分隔
DISCORD_ALLOWED_CHANNEL_IDS=987654321098765432

# （可选）允许的服务器 ID 白名单，逗号分隔
DISCORD_ALLOWED_GUILD_IDS=135792468013579246
```

**安全建议**：个人使用请务必配置 `DISCORD_ALLOWED_USER_IDS`，只允许你自己使用！

## 四、启动服务

配置完成后，Electron 会在后台按 RoxyClaw 的 `enabled` 配置启动同一个 agent 进程内的 IM 能力。如果配置正确，你会在日志中看到：

```
[IM] Checking Discord config: BOT_TOKEN=set
[Discord] Creating lightweight Discord client...
[Discord] Connecting to gateway: ...
[Discord] Ready!
[IM] Discord adapter started.
[IM] IM service running with 1 platform(s).
```

## 五、使用方法

### 基本对话

1. 打开 Discord
2. 找到你的 Bot（在服务器成员列表或直接私信）
3. 直接发消息即可开始对话
4. Bot 会自动回复

### 可用命令

- `/new` - 创建新对话（清空历史上下文）
- `/clear` - 清空对话历史
- `/status` - 查看当前对话状态

## 六、权限说明

### Bot 权限（已在 URL Generator 中配置）

| 权限 | 用途 |
|------|------|
| Send Messages | 发送回复消息 |
| Read Message History | 读取消息历史（用于上下文） |
| Read Messages/View Channels | 查看频道和消息 |
| Attach Files | （可选）发送文件 |
| Embed Links | （可选）嵌入链接 |

### Gateway Intents（必须在 Developer Portal 开启）

| Intent | 用途 |
|--------|------|
| Presence Intent | 查看用户状态 |
| Server Members Intent | 读取服务器成员 |
| Message Content Intent | **最重要** - 读取消息内容，没有这个 Bot 看不到消息！ |

## 七、常见问题

### Q: Bot 不在线？

A: 检查：
1. Roxy Agent 服务是否启动
2. Token 是否正确配置
3. 查看服务日志是否有错误

### Q: Bot 能看到消息但不回复？

A: 检查：
1. **Privileged Gateway Intents** 的三个开关是否都开启了
2. 特别是 **Message Content Intent** 必须开启
3. 开启后需要重启 Roxy Agent

### Q: 提示 "未授权访问"？

A: 你配置了白名单，但你的用户 ID 不在里面。请检查：
1. 确认你的用户 ID 是否正确
2. 检查 `DISCORD_ALLOWED_USER_IDS` 配置
3. 或者临时清空白名单测试

### Q: 怎么更新 Bot 的头像/名字？

A: 回到 [Discord Developer Portal](https://discord.com/developers/applications)，在 **Bot** 页面可以修改。

### Q: Token 泄露了怎么办？

A: 立即去 Developer Portal 的 **Bot** 页面，点击 **"Reset Token"**，然后更新环境变量中的 Token。

### Q: 可以在多个服务器使用吗？

A: 可以，但建议配置白名单限制用户。用同一个 Invite URL 可以把 Bot 加到多个服务器。

## 八、快速检查清单

配置完成后，用这个清单检查：

- [ ] Application 已创建
- [ ] Bot 已添加
- [ ] Bot Token 已获取并保存
- [ ] Presence Intent 已开启
- [ ] Server Members Intent 已开启
- [ ] Message Content Intent 已开启
- [ ] OAuth2 URL Generator 已勾选 bot scope
- [ ] Bot 权限已配置（Send Messages、Read Message History、Read Messages）
- [ ] Invite URL 已打开，Bot 已加入服务器
- [ ] 开发者模式已开启
- [ ] 你的用户 ID 已获取
- [ ] 环境变量已配置（特别是 `DISCORD_ALLOWED_USER_IDS`）
- [ ] Roxy Agent 已启动
- [ ] Bot 在 Discord 中显示为在线
