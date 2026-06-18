# Forward 错误状态与排查

本文档描述 `app/api/forward` 相关接口当前的错误契约，以及生产环境出现报错后的排查路径。

适用范围：

- `/v1/chat/completions`
- `/v1/messages`
- `/v1/images/generations`
- `/v1/images/edits`
- `/v1/proxy/*`

## 总原则

- 成功与失败必须由 HTTP 状态表达，不能返回 `200 + error json`
- 成功响应尽量保持上游兼容格式
- 错误响应统一为服务端自己的错误信封：

```json
{
  "code": "provider_quota_exceeded",
  "message": "Upstream provider quota is exhausted",
  "request_id": "req_xxx",
  "data": {
    "source": "upstream",
    "category": "provider_quota",
    "retryable": false,
    "request_id": "req_xxx",
    "provider": "openai",
    "model": "gpt-image-1",
    "upstream": {
      "status": 402,
      "code": "insufficient_quota",
      "type": "insufficient_quota",
      "message": "You exceeded your current quota.",
      "body": {
        "error": {
          "message": "You exceeded your current quota.",
          "type": "insufficient_quota",
          "code": "insufficient_quota"
        }
      }
    }
  }
}
```

说明：

- `code` 是前端应依赖的稳定业务码
- `message` 是给用户或调用方展示的可读文案
- `request_id` 是统一错误追踪 ID，前端可以直接展示给用户复制
- `data.source` 取值为 `local` 或 `upstream`
- `data.category` 是归一化后的错误分类
- `data.retryable` 表示是否建议客户端稍后重试
- `data.request_id` 在 forward 错误中同样保留，便于前后端统一取值
- `data.upstream.*` 用于排查，保留上游原始错误语义
- 响应头也会带 `X-Request-ID`

## request_id 传递约定

### request_id 从哪里来

- 如果客户端请求时带了 `X-Request-ID`，服务会沿用这个值
- 如果客户端没有带，服务会在请求进入时自动生成一个 UUID

这个 `request_id` 会出现在三处：

1. 错误响应顶层字段 `request_id`
2. 错误响应 `data.request_id`
3. 响应头 `X-Request-ID`

同时它也会进入后端日志，例如：

```text
[user=138173 req=e8fa4ad5-1b5b-4f17-8f7a-fc9ac886c839]
```

这里的 `req=...` 和前端拿到的 `request_id` 是同一个值。

### 为什么要返回 request_id

目的不是给业务逻辑使用，而是给排查使用：

- 前端可以把 `request_id` 展示给用户
- 用户报障时可以直接复制这个 ID
- 后端可以拿这个 ID 去主日志、access 日志、数据库里快速定位问题

## 前端接入约定

前端只需要处理后端返回的统一错误结构，不需要理解不同上游 provider 的原始错误协议。

### 错误响应结构

所有 forward 相关错误都按下面这个结构处理：

```json
{
  "code": "provider_quota_exceeded",
  "message": "Upstream provider quota is exhausted",
  "request_id": "e8fa4ad5-1b5b-4f17-8f7a-fc9ac886c839",
  "data": {
    "request_id": "e8fa4ad5-1b5b-4f17-8f7a-fc9ac886c839",
    "source": "upstream",
    "category": "provider_quota",
    "retryable": false,
    "provider": "deepseek",
    "model": "deepseek-v4-pro",
    "upstream": {
      "status": 402,
      "code": "insufficient_quota",
      "type": "insufficient_quota",
      "message": "You exceeded your current quota.",
      "body": {
        "error": {
          "message": "You exceeded your current quota."
        }
      }
    }
  }
}
```

### 前端如何判断失败

- 只认 HTTP 状态
- 不要用“是不是有 `message` / `code`”来判断是否失败
- `2xx` 视为成功，非 `2xx` 视为失败

### 前端如何取 request_id

推荐优先级：

1. 顶层 `request_id`
2. `data.request_id`
3. 响应头 `X-Request-ID`

也就是说，正常情况下前端直接取顶层 `request_id` 即可。

### 前端如何使用这些字段

- `code`：用于稳定分支判断
- `message`：用于错误提示展示
- `request_id`：用于页面展示、复制、报障
- `data.category`：如需更细分类可用，但不要依赖 `data.upstream.body`
- `data.upstream.body`：仅用于排查，不建议前端写业务逻辑依赖它

### 建议前端展示方式

最简单的方式：

- 页面错误提示展示 `message`
- 在错误详情或提示文案中展示 `request_id`

示例文案：

- `请求失败，请稍后重试。`
- `如需协助，请提供请求ID：e8fa4ad5-1b5b-4f17-8f7a-fc9ac886c839`

### 不建议前端做的事情

- 不要把 `data.upstream.body` 直接原样展示给终端用户
- 不要根据不同 provider 的原始错误结构写分支
- 不要假设 `request_id` 一定由前端生成

## 错误来源

### 1. 本地错误

本地错误指还没有请求上游，错误已经在本服务内被判定。

常见场景：

- 鉴权失败
- 用户余额、积分、图片配额不足
- 模型未配置
- 模型不支持
- 本地并发限流
- 请求体校验失败

这类错误特征：

- `data.source = "local"`
- HTTP 状态通常为 `4xx`
- 前端通常可以直接给用户明确提示

### 2. 上游错误

上游错误指已经成功请求到 provider，但 provider 返回了错误。

常见场景：

- 上游判定参数不合法
- 上游内容审核拒绝
- 上游限流
- 上游 key 无效
- 上游账号额度耗尽
- 上游 5xx、超时、网络异常

这类错误特征：

- `data.source = "upstream"`
- `data.upstream` 中保留上游状态码、错误码、原始 body
- HTTP 状态会先做归因，再映射为对客户端更稳定的状态

## HTTP 状态约定

| HTTP 状态 | 业务码 `code` | 分类 `category` | 含义 | 是否通常可由用户处理 |
|-----------|---------------|------------------|------|------------------------|
| `400` | `model_not_configured` | `invalid_request` | 默认模型未配置 | 否 |
| `400` | `model_not_supported` | `invalid_request` | 请求模型不支持 | 是 |
| `400` | `upstream_invalid_request` | `invalid_request` | 上游判定请求参数不合法 | 是 |
| `400` / `422` | `upstream_content_policy_violation` | `content_policy` | 上游内容安全策略拒绝 | 是 |
| `401` | 依赖全局鉴权返回 | - | 缺少或无效 token | 是 |
| `402` | `insufficient_points` | `billing` | 用户自己的余额、积分或图片额度不足 | 是 |
| `422` | `upstream_invalid_request` | `invalid_request` | 上游返回更精确的语义校验失败 | 是 |
| `429` | `forward_rate_limited` | `rate_limit` | 本地 forward 并发限流 | 可重试 |
| `429` | `upstream_rate_limited` | `rate_limit` | 上游限流 | 可重试 |
| `503` | `provider_auth_failed` | `provider_auth` | 上游 key 无效、权限异常 | 否 |
| `503` | `provider_quota_exceeded` | `provider_quota` | 上游 provider 账号额度耗尽 | 否 |
| `503` | `provider_not_found` | `provider_not_found` | 上游路径、模型路由或 provider 配置异常 | 否 |
| `503` | `provider_unavailable` | `provider_unavailable` | 上游不可用、5xx、未知异常 | 否 |
| `504` | `provider_timeout` | `provider_timeout` | 上游超时 | 否 |
| `500` | 全局异常处理返回 | - | 本服务未捕获异常 | 否 |

## 上游状态映射规则

当前 forward 层不会简单地把上游状态原样透传给前端，而是先做归因。

### 保留为客户端错误的场景

- 上游 `400` / `422` 且本质是参数错误
- 上游内容安全、审核、政策拒绝
- 上游 `429`

这类错误会保留为 `400` / `422` / `429`，因为调用方有机会调整输入或稍后重试。

### 改写为服务端错误的场景

- 上游 `401` / `403`，通常代表 provider key 配置或权限有问题
- 上游 `402`，通常代表 provider 账号余额或额度有问题
- 上游 `5xx`
- 上游超时、网络错误、非预期错误

这类错误会映射为 `503` 或 `504`，因为问题在服务到 provider 这层，而不是终端用户自身。

关键区分：

- 用户自己的余额不足：返回 `402`
- 服务配置的 provider key 没额度：返回 `503`

## 常见错误示例

### 用户自己的积分不足

```json
{
  "code": "insufficient_points",
  "message": "Insufficient points",
  "data": {
    "source": "local",
    "category": "billing"
  }
}
```

### 上游内容安全拦截

```json
{
  "code": "upstream_content_policy_violation",
  "message": "Prompt violates content policy",
  "data": {
    "source": "upstream",
    "category": "content_policy",
    "retryable": false,
    "request_id": "req_xxx",
    "provider": "openai",
    "model": "gpt-image-1",
    "upstream": {
      "status": 400,
      "code": "content_policy_violation",
      "type": "invalid_request_error",
      "message": "Prompt violates content policy",
      "body": {
        "error": {
          "message": "Prompt violates content policy",
          "code": "content_policy_violation"
        }
      }
    }
  }
}
```

### 上游 provider 额度耗尽

```json
{
  "code": "provider_quota_exceeded",
  "message": "Upstream provider quota is exhausted",
  "data": {
    "source": "upstream",
    "category": "provider_quota",
    "retryable": false,
    "request_id": "req_xxx",
    "provider": "openai",
    "model": "gpt-image-1",
    "upstream": {
      "status": 402,
      "code": "insufficient_quota",
      "type": "insufficient_quota",
      "message": "You exceeded your current quota.",
      "body": {
        "error": {
          "message": "You exceeded your current quota.",
          "type": "insufficient_quota",
          "code": "insufficient_quota"
        }
      }
    }
  }
}
```

### 上游限流

```json
{
  "code": "upstream_rate_limited",
  "message": "Rate limit exceeded",
  "data": {
    "source": "upstream",
    "category": "rate_limit",
    "retryable": true,
    "request_id": "req_xxx",
    "provider": "openai",
    "model": "gpt-4.1",
    "upstream": {
      "status": 429,
      "code": "rate_limit_exceeded",
      "type": "rate_limit_error",
      "message": "Rate limit exceeded",
      "body": {
        "error": {
          "message": "Rate limit exceeded"
        }
      }
    }
  }
}
```

说明：

- 如上游返回了 `Retry-After`，服务会继续透传给前端
- 本地并发限流同样会返回 `429` 和 `Retry-After`

## 日志字段说明

forward 路由在遇到上游错误时，主日志会输出统一结构化字段。

典型字段包括：

- `request_id`
- `user_id`
- `provider`
- `model`
- `status`
- `upstream_status`
- `upstream_code`
- `category`
- `retryable`
- `response_time`
- `upstream_message`
- `upstream_body`

这意味着即使前端只上报了一个 `request_id`，后端也可以把一次错误完整串起来。

## 生产报错排查路径

推荐固定使用以下顺序排查。

### 第一步：先拿 `request_id`

优先来源：

- 前端收到的错误响应中的 `data.request_id`
- 前端收到的错误响应顶层 `request_id`
- 客户端请求头或响应头中的 `X-Request-ID`
- 管理后台或调用链日志里记录的 request id

没有 `request_id` 时，排查成本会明显变高。

### 第二步：看主日志

默认位置：

- `logs/app.YYYYMMDD.log`
- 若 `LOG_DIR` 为空，则看进程 stdout / supervisor 日志

先搜索：

```bash
grep 'request_id=req_xxx' logs/app*.log
```

重点看：

- 是否命中本地错误还是上游错误
- `provider` / `model` 是否符合预期
- `status` 与 `upstream_status` 是否一致
- `upstream_code` / `upstream_message` / `upstream_body`

### 第三步：看 access detail log

默认位置：

- `logs/access.log`
- 历史轮转文件：`logs/access.log.1`、`logs/access.log.2` ...

搜索：

```bash
grep -n 'request_id=req_xxx' logs/access.log logs/access.log.*
```

这里通常能看到：

- 请求路径
- 请求体摘要
- 响应状态
- 非流式响应 body
- 流式响应的错误事件摘要

适合确认：

- 客户端实际传了什么参数
- 服务最终回了什么错误体
- 是否存在前端“说法”和实际请求不一致的情况

### 第四步：查数据库 `agent_requests`

表名：`agent_requests`

关键字段：

- `request_id`
- `user_id`
- `provider`
- `model`
- `status`
- `error_message`
- `response_time`
- `created_at`

示例：

```sql
select
  request_id,
  user_id,
  provider,
  model,
  status,
  error_message,
  response_time,
  created_at
from agent_requests
where request_id = 'req_xxx';
```

适合确认：

- 服务是否已写入请求记录
- 最终状态是 `completed` 还是 `failed`
- `error_message` 是否为 `upstream_http_429`、`brief_exc(...)` 等

### 第五步：如需对话原文，查导出接口

管理端提供了对话下载能力，可通过 `request_id` 获取完整请求/响应日志：

- 接口位置：`app/api/admin/conversations.py`
- 适合复盘某次对话上下文、输入输出原文和问题复现

### 第六步：按错误类型继续深挖

#### A. 本地 `402`

- `insufficient_points`

排查：

- 用户账户余额、积分、图片额度是否真的不足
- 当前是否为团队计费，关注 `billing_user_id`
- Redis 与 MySQL 是否一致

#### B. 上游 `provider_auth_failed`

排查：

- provider key 是否过期、被吊销或配置错误
- 对应 provider 的 `base_url` 是否正确
- 是否误用了不匹配的鉴权头格式

#### C. 上游 `provider_quota_exceeded`

排查：

- provider 账号本身是否欠费、额度已用尽
- 是否命中了 provider 的项目级、模型级或组织级限额
- 是否只是某个特定模型无额度

#### D. 上游 `upstream_content_policy_violation`

排查：

- 直接看 `data.upstream.body`
- 确认是 prompt、图片输入还是某个参数触发了拦截
- 这类通常不应重试，应该引导用户改输入

#### E. 上游 `upstream_invalid_request`

排查：

- 请求字段、类型、枚举值、图片大小、文件格式
- 模型是否支持该参数
- 上游是否 recently changed 参数校验规则

#### F. 上游 `upstream_rate_limited`

排查：

- 是否存在瞬时流量尖峰
- 是否透传了 `Retry-After`
- 服务自己的重试是否已经耗尽

#### G. 上游 `provider_unavailable` / `provider_timeout`

排查：

- provider 服务状态
- 本机到上游网络是否异常
- DNS、代理、出口网络、TLS 是否有问题
- 当前超时配置是否过短

## 流式接口的特殊说明

流式接口有一个天然限制：

- 建连前失败：可以正常返回非 `200` 的 HTTP 错误
- 建连后失败：HTTP 状态已经发出，后续不能再改成 `4xx/5xx`

因此流式问题排查时要额外看：

- 主日志里是否出现 `stream connect upstream failed`
- access detail log 里是否有 SSE `error` 事件
- 客户端是否在没有正常结束标记时把断流视为失败

## 给前端和调用方的建议

- 只用 HTTP 状态判断请求成败
- 用 `code` 做稳定分支判断
- 用 `message` 做展示
- 用 `request_id` 或 `data.request_id` 做报错上报
- 不要依赖 `data.upstream.body` 的细节做业务逻辑

`data.upstream.body` 是排查信息，不是稳定对外协议。
