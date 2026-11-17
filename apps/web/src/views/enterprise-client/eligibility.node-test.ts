import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isEnterpriseProfilePurchaseEligible, isEnterpriseProxyPurchaseEligible, isEnterpriseRechargeEligible } from './eligibility'

test('single recharge includes $200 and excludes amounts below $200', () => {
  assert.equal(isEnterpriseRechargeEligible(199.99), false)
  assert.equal(isEnterpriseRechargeEligible(200), true)
  assert.equal(isEnterpriseRechargeEligible(200.01), true)
  assert.equal(isEnterpriseRechargeEligible(1000), true)
})

test('missing or invalid recharge amounts never qualify', () => {
  for (const amount of [undefined, Number.NaN, Infinity, -Infinity, -200, 0]) {
    assert.equal(isEnterpriseRechargeEligible(amount), false)
  }
})

test('单次购买满 10 条 IP 才符合弹窗条件', () => {
  assert.equal(isEnterpriseProxyPurchaseEligible(9), false)
  assert.equal(isEnterpriseProxyPurchaseEligible(10), true)
  assert.equal(isEnterpriseProxyPurchaseEligible(11), true)
  assert.equal(isEnterpriseProxyPurchaseEligible(100), true)
})

test('缺失、非整数或无效 IP 数量不触发弹窗', () => {
  for (const quantity of [undefined, Number.NaN, Infinity, -Infinity, -10, 0, 9.99, 10.5]) {
    assert.equal(isEnterpriseProxyPurchaseEligible(quantity), false)
  }
})

test('本次付费窗口订单包含 200 个时触发优惠弹窗', () => {
  assert.equal(isEnterpriseProfilePurchaseEligible(199), false)
  assert.equal(isEnterpriseProfilePurchaseEligible(200), true)
  assert.equal(isEnterpriseProfilePurchaseEligible(201), true)
  assert.equal(isEnterpriseProfilePurchaseEligible(3000), true)
})

test('缺失、非整数或无效窗口数量不触发优惠弹窗', () => {
  for (const quantity of [undefined, Number.NaN, Infinity, -Infinity, -200, 0, 199.99, 200.5]) {
    assert.equal(isEnterpriseProfilePurchaseEligible(quantity), false)
  }
})
