import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import { marked, Renderer } from 'marked'
import { escapeHtml } from './markdownHtml'
import { renderMarkdown } from './markdown'
import { getAgentMarkdownTokenLabel, normalizeAgentMarkdownTokenKind } from '../components/markdown/AgentMarkdownTokenElement'

test('escapes raw HTML so form controls are displayed as text', () => {
  const source = '<input type="text" value=""><input type="password" style="opacity: 0;">'

  assert.equal(
    escapeHtml(source),
    '&lt;input type=&quot;text&quot; value=&quot;&quot;&gt;&lt;input type=&quot;password&quot; style=&quot;opacity: 0;&quot;&gt;',
  )
})

test('keeps Markdown formatting while rendering raw HTML as text', () => {
  const renderer = new Renderer()
  renderer.html = ({ text }) => escapeHtml(text)

  const output = marked.parse('**说明**\n\n<input type="text" value="">', {
    async: false,
    renderer,
  })

  assert.doesNotMatch(output, /<input\b/)
  assert.match(output, /&lt;input type=&quot;text&quot;/)
  assert.match(output, /<strong>说明<\/strong>/)
})

test('escapes attributes and element content', () => {
  assert.equal(
    escapeHtml('<div title="Tom & Jerry">O\'Reilly</div>'),
    '&lt;div title=&quot;Tom &amp; Jerry&quot;&gt;O&#39;Reilly&lt;/div&gt;',
  )
})

test('adds a copy control that preserves source markdown for tables', () => {
  const source = '| 城市 | 门店数 |\n| --- | ---: |\n| 上海 | 18 |'
  const output = renderMarkdown(source)
  const match = output.match(/encoded-markdown="([^"]+)"/)

  assert.match(output, /class="agent-md-table"/)
  assert.match(output, /<roxy-agent-table-copy/)
  assert.equal(match ? decodeURIComponent(match[1]) : '', source)
})

test('adds a copy control that copies code block text', () => {
  const source = '```ts\nconst answer = 42\n```'
  const output = renderMarkdown(source)
  const match = output.match(/encoded-code="([^"]+)"/)

  assert.match(output, /class="agent-md-code"/)
  assert.match(output, /<roxy-agent-code-copy/)
  assert.equal(match ? decodeURIComponent(match[1]) : '', 'const answer = 42')
})

test('renders links with empty destinations as plain Markdown text', () => {
  const output = renderMarkdown('[xxxx]()')

  assert.match(output, /<p>\[xxxx\]\(\)<\/p>/)
  assert.doesNotMatch(output, /<a\b/)
})

test('keeps the original Markdown source on rendered links for selection actions', () => {
  const source = '[完整报告](https://example.com/report)'
  const output = renderMarkdown(source)
  const match = output.match(/data-markdown-source="([^"]+)"/)

  assert.equal(match ? decodeURIComponent(match[1]) : '', source)
})

test('adds favicon targets to web links and skips local file links', () => {
  const output = renderMarkdown('Open https://example.com/docs and [report](/Users/admin/report.md)')

  assert.match(output, /data-agent-favicon-url="https:\/\/example\.com\/favicon\.ico"/)
  assert.equal([...output.matchAll(/data-agent-favicon-url=/g)].length, 1)
})

test('preserves soft line breaks only when requested', () => {
  const source = 'first line\nsecond line'

  assert.doesNotMatch(renderMarkdown(source), /<br>/)
  assert.match(renderMarkdown(source, { preserveLineBreaks: true }), /first line<br>second line/)
})

test('stops bare URLs before CJK closing punctuation', () => {
  const output = renderMarkdown('评估 商品（https://example.com/product）在 美国 的社媒爆款潜力')

  assert.match(output, /href="https:\/\/example\.com\/product"/)
  assert.match(output, />https:\/\/example\.com\/product<\/a>）在 美国/)
  assert.doesNotMatch(output, /product%EF%BC%89%E5%9C%A8/)
})

test('renders agent tokens immediately after punctuation that ends a bare URL', () => {
  const output = renderMarkdown('账号信息：https://www.facebook.com，[input:点击填写账密信息]()。')

  assert.match(output, /href="https:\/\/www\.facebook\.com"/)
  assert.match(output, /<\/a>，<roxy-agent-token kind="input" title="点击填写账密信息" target=""><\/roxy-agent-token>。/)
  assert.doesNotMatch(output, /\[input:点击填写账密信息\]/)
})

test('keeps HTML escaped when reparsing text after a bare URL boundary', () => {
  const output = renderMarkdown('查看 https://example.com，<input value="secret">')

  assert.match(output, /<\/a>，&lt;input value=&quot;secret&quot;&gt;/)
  assert.doesNotMatch(output, /<input\b/)
})

test('stops www URLs before CJK closing punctuation', () => {
  const output = renderMarkdown('评估 111（www.baidu.com）在 小红书 的社媒爆款潜力，并给出趋势阶段、风险、内容角度和首轮测试方案。')

  assert.match(output, /href="http:\/\/www\.baidu\.com"/)
  assert.match(output, />www\.baidu\.com<\/a>）在 小红书/)
  assert.doesNotMatch(output, /baidu\.com%EF%BC%89%E5%9C%A8/)
})

test('keeps adjacent prompt text outside an explicit URL link', () => {
  const href = 'https://cn.bing.com/search?q=%E7%BF%BB%E8%AF%91'
  const output = renderMarkdown(`[${href}](${href})这是什么链接还是文本`)

  assert.match(output, /href="https:\/\/cn\.bing\.com\/search\?q=%E7%BF%BB%E8%AF%91"/)
  assert.match(output, /<\/a>这是什么链接还是文本/)
  assert.doesNotMatch(output, /href="[^"]*%E8%BF%99%E6%98%AF/)
})

test('keeps CJK URL paths inside the link before sentence punctuation', () => {
  const output = renderMarkdown('查看 https://example.com/商品详情，然后继续')

  assert.match(output, /href="https:\/\/example\.com\/%E5%95%86%E5%93%81%E8%AF%A6%E6%83%85"/)
  assert.match(output, />https:\/\/example\.com\/商品详情<\/a>，然后继续/)
})

test('keeps balanced ASCII parentheses inside bare URLs', () => {
  const output = renderMarkdown('查看 https://en.wikipedia.org/wiki/Function_(mathematics) 获取定义')

  assert.match(output, /href="https:\/\/en\.wikipedia\.org\/wiki\/Function_\(mathematics\)"/)
  assert.match(output, />https:\/\/en\.wikipedia\.org\/wiki\/Function_\(mathematics\)<\/a> 获取定义/)
})

test('normalizes markdown links with a leading slash before a Windows drive', () => {
  const output = renderMarkdown('[完整竞品报告](/C:/Users/admin/.roxy-agent/output/report.md)')

  assert.match(output, /href="C:\/Users\/admin\/\.roxy-agent\/output\/report\.md"/)
  assert.doesNotMatch(output, /href="\/C:/)
})

test('normalizes backslashes in markdown links with Windows drive paths', () => {
  const output = renderMarkdown('[报告](/D:\\Users\\admin\\report.md)')

  assert.match(output, /href="D:\/Users\/admin\/report\.md"/)
  assert.doesNotMatch(output, /href="\/D:/)
})

test('keeps POSIX local paths unchanged when normalizing file links', () => {
  const macOutput = renderMarkdown('[报告](/Users/admin/report.md)')
  const linuxOutput = renderMarkdown('[报告](/home/admin/report.md)')

  assert.match(macOutput, /href="\/Users\/admin\/report\.md"/)
  assert.match(linuxOutput, /href="\/home\/admin\/report\.md"/)
})

test('uses input token presentation instead of the skill fallback', () => {
  const kind = normalizeAgentMarkdownTokenKind('input')

  assert.equal(kind, 'input')
  assert.equal(getAgentMarkdownTokenLabel(kind, 'Product name', ''), 'Product name')
  assert.equal(getAgentMarkdownTokenLabel(kind, 'Product name', 'Roxy Browser'), 'Roxy Browser')
  assert.equal(normalizeAgentMarkdownTokenKind('unknown'), 'skill')
})
test('renders input protocol tokens like composer tokens', () => {
  const filled = renderMarkdown('Use [input:Product name](Roxy Browser)')
  const empty = renderMarkdown('Use [input:Product name]()')

  assert.match(filled, /<roxy-agent-token kind="input" title="Roxy Browser" target="Roxy Browser"><\/roxy-agent-token>/)
  assert.match(empty, /<roxy-agent-token kind="input" title="Product name" target=""><\/roxy-agent-token>/)
})

test('renders url protocol tokens with their dedicated token kind', () => {
  const httpsUrl = renderMarkdown('Open [url:Website](https://example.com/docs)')
  const empty = renderMarkdown('Open [url:Website]()')

  assert.match(httpsUrl, /<roxy-agent-token kind="url" title="https:\/\/example\.com\/docs" target="https:\/\/example\.com\/docs"><\/roxy-agent-token>/)
  assert.match(empty, /<roxy-agent-token kind="url" title="Website" target=""><\/roxy-agent-token>/)
})

test('renders profile references with the split profile badge details', () => {
  const originalTranslate = globalThis.$t
  globalThis.$t = (key, params) => key.replace('{count}', String(params?.count))

  try {
    const output = renderMarkdown('Run [@profile:2](profile-1,profile-2)')

    assert.match(output, /<roxy-agent-token[^>]+kind="profile"/)
    assert.match(output, /title="窗口"/)
    assert.match(output, /count="2"/)
    assert.doesNotMatch(output, /details=/)
    assert.doesNotMatch(output, /title="2 窗口"/)
    assert.doesNotMatch(output, /Window/)
  }
  finally {
    globalThis.$t = originalTranslate
  }
})

test('renders an unselected profile reference with the composer token label', () => {
  const originalTranslate = globalThis.$t
  globalThis.$t = key => key

  try {
    const output = renderMarkdown('Open [@profile:0]()')

    assert.match(output, /<roxy-agent-token kind="profile" title="选择窗口" target=""><\/roxy-agent-token>/)
    assert.doesNotMatch(output, /\[@profile:0\]/)
  }
  finally {
    globalThis.$t = originalTranslate
  }
})
