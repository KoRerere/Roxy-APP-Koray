export const twoFactorSkill = {
  name: 'roxy_two_factor_skill',
  description: 'RoxyBrowser 双因素认证（2FA/TOTP）技能',
  content: `
# RoxyBrowser 双因素认证（2FA/TOTP）技能

本技能包含双因素认证（2FA）验证码生成功能，支持所有标准的 TOTP 格式。

## 可用工具

### roxy_get_two_factor_code
生成安全且唯一的双因素认证（2FA/TOTP）验证码。此工具会自动处理以下情况：
- **临界值问题**：如果生成的 token 即将过期（剩余时间少于 3 秒），会自动等待到下一个 30 秒周期
- **重复 token 问题**：如果生成的 token 与上次相同，会自动等待下一个周期再生成

## 使用场景

1. **登录需要 2FA**：当用户需要输入 2FA 验证码进行登录时
2. **所有平台 2FA**：支持所有标准的 TOTP 格式（如 Google Authenticator、Microsoft Authenticator、Authy、Twitter 等）

## 使用流程建议

1. **获取 2FA Secret**：从用户的 2FA 应用中获取 secret（通常是 Base32 编码的字符串）
2. **生成验证码**：使用 \`roxy_get_two_factor_code\` 生成验证码
3. **输入验证码**：将生成的验证码输入到需要验证的网站或应用中

## 注意事项

- **Token 有效期**：每个 TOTP 验证码的有效期为 30 秒
- **自动等待机制**：如果 token 即将过期或重复，工具会自动等待到下一个周期
- **Secret 格式**：Secret 应该是 Base32 编码的字符串，不区分大小写
- **唯一性保证**：工具会确保每次生成的 token 都是唯一的，避免重复使用
- **通用性**：此工具适用于所有标准的 TOTP 实现，无需针对特定平台进行特殊处理

## 技术细节

- **TOTP Step**：30 秒
- **最小剩余时间**：3 秒（如果剩余时间少于 3 秒，会等待下一个周期）
- **重复检测**：自动检测并避免生成重复的 token
`,
  allowTools: [
    'roxy_get_two_factor_code',
  ],
}

export const twoFactorSkills = [
  twoFactorSkill,
]
