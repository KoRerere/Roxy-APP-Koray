import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import test from 'node:test'
import { getWebSearchToolPresentation } from './webSearchToolPresentation'

test('normalizes web search queries and derives a first-party favicon URL', () => {
  // Regression: server web-search actions contained internal ws_call_id values
  // and raw tracking fragments that should never be shown in Agent Console.
  const search = getWebSearchToolPresentation({
    type: 'search',
    queries: [' RoxyBrowser 价格 ', 'ws_call_id=ws_1', '', 'AdsPower 价格'],
  })
  const openPage = getWebSearchToolPresentation({
    type: 'open_page',
    url: 'https://roxybrowser.cn/pricing?from=agent&ws_call_id=ws_2#ws_call_id=ws_2',
  })
  const findInPage = getWebSearchToolPresentation({
    type: 'find_in_page',
    url: 'https://roxybrowser.cn/faqs#ws_call_id=ws_3',
    pattern: ' 普通浏览器 ',
  })

  assert.deepEqual(search, {
    action: 'search',
    queries: ['RoxyBrowser 价格', 'AdsPower 价格'],
  })
  assert.deepEqual(openPage, {
    action: 'open_page',
    url: 'https://roxybrowser.cn/pricing?from=agent',
    faviconUrl: 'https://roxybrowser.cn/favicon.ico',
  })
  assert.deepEqual(findInPage, {
    action: 'find_in_page',
    url: 'https://roxybrowser.cn/faqs',
    pattern: '普通浏览器',
    faviconUrl: 'https://roxybrowser.cn/favicon.ico',
  })
})

test('silently omits favicon loading for invalid or unsupported URLs', () => {
  assert.deepEqual(getWebSearchToolPresentation({ type: 'open_page', url: 'about:blank' }), {
    action: 'open_page',
    url: 'about:blank',
  })
  assert.equal(getWebSearchToolPresentation({ type: 'open_page', url: '   ' }), undefined)
})
