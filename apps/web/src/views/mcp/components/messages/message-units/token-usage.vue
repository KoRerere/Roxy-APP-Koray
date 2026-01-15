<!--
  Token 使用信息显示组件

  用于显示 AI 响应消耗的 Token 数量，包括输入、输出、总计和费用。
  通常显示在每条 AI 消息的下方，帮助用户了解 API 调用成本。

  Props:
    - tokenUsage: TokenUsage - Token 使用信息对象

  TokenUsage 接口字段：
    - input?: number - 输入 token 数量
    - output?: number - 输出 token 数量
    - total?: number - 总 token 数量
    - cost?: number - 成本（美元）

  显示特点：
    - 总计和费用使用特殊的高亮样式
    - 数字使用千分位格式化显示
    - 费用保留 4 位小数
-->
<script setup lang="ts">
import type { TokenUsage } from '../../../types.js'

defineProps<{
  /** Token 使用信息对象 */
  tokenUsage: TokenUsage
}>()
</script>

<template>
  <div class="token-usage">
    <div class="token-usage-header">
      <span class="token-icon">📊</span>
      <span class="token-label">Token 消耗</span>
    </div>
    <div class="token-usage-details">
      <span v-if="tokenUsage.input != null" class="token-item">
        <span class="token-item-label">输入：</span>
        <span class="token-item-value">{{ tokenUsage.input.toLocaleString() }}</span>
      </span>
      <span v-if="tokenUsage.output != null" class="token-item">
        <span class="token-item-label">输出：</span>
        <span class="token-item-value">{{ tokenUsage.output.toLocaleString() }}</span>
      </span>
      <span v-if="tokenUsage.total != null" class="token-item token-item-total">
        <span class="token-item-label">总计：</span>
        <span class="token-item-value">{{ tokenUsage.total.toLocaleString() }}</span>
      </span>
      <span v-if="tokenUsage.cost != null" class="token-item token-item-cost">
        <span class="token-item-label">费用：</span>
        <span class="token-item-value">${{ tokenUsage.cost.toFixed(4) }}</span>
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.token-usage {
  margin-top: 12px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 8px;
  border-left: 3px solid #667eea;
  font-size: 12px;
}

.token-usage-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--colors-text-text-primary, #212529);
}

.token-icon {
  font-size: 14px;
}

.token-label {
  font-weight: 600;
}

.token-usage-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.token-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
  font-size: 11px;
}

.token-item-label {
  color: var(--colors-text-text-secondary, #6c757d);
  font-weight: 500;
}

.token-item-value {
  color: var(--colors-text-text-primary, #212529);
  font-weight: 600;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}

.token-item-total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.token-item-total .token-item-label,
.token-item-total .token-item-value {
  color: white;
}

.token-item-cost {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.token-item-cost .token-item-label,
.token-item-cost .token-item-value {
  color: white;
}
</style>

