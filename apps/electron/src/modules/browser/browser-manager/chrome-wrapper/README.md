# Chrome Wrapper

这是一个基于 `chrome-remote-interface` 的轻量级 Chrome 浏览器控制封装，提供类似 `puppeteer-core` 的 API。

## 功能特性

- 轻量级：相比 puppeteer-core 更小的包体积
- 兼容性：提供与 puppeteer-core 相似的 API
- 类型安全：完整的 TypeScript 类型支持
- 进程管理：支持监听 Chrome 进程的各种事件

## 安装

```bash
npm install chrome-remote-interface
npm install --save-dev puppeteer-core @types/chrome-remote-interface
```

## 基本使用

```typescript
import { launch, connect } from './chrome-wrapper'

// 启动新的浏览器实例
const browser = await launch({
  executablePath: '/path/to/chrome',
  args: ['--no-sandbox'],
  headless: false
})

// 或连接到已有的浏览器
const browser = await connect({
  browserWSEndpoint: 'ws://localhost:9222/devtools/browser/...'
})

// 创建新页面
const page = await browser.newPage()
await page.goto('https://example.com')

// 关闭浏览器
await browser.close()
```

## 进程事件监听

Chrome Wrapper 支持监听 Chrome 进程的各种事件，这对于监控浏览器状态和处理异常情况非常有用。

### 可用事件

- `process-exit`: Chrome 进程退出时触发
- `process-close`: Chrome 进程关闭时触发
- `process-error`: Chrome 进程发生错误时触发
- `disconnected`: 与浏览器的连接断开时触发
- `targetcreated`: 新的目标（页面、iframe 等）创建时触发
- `targetdestroyed`: 目标被销毁时触发
- `targetchanged`: 目标信息变化时触发

### 示例代码

```typescript
const browser = await launch({
  executablePath: '/path/to/chrome',
  args: ['--no-sandbox']
})

// 监听进程退出
browser.on('process-exit', ({ code, signal }) => {
  console.log(`Chrome 进程已退出，退出码: ${code}, 信号: ${signal}`)
})

// 监听进程错误
browser.on('process-error', (error) => {
  console.error('Chrome 进程错误:', error)
})

// 监听连接断开
browser.on('disconnected', () => {
  console.log('与浏览器的连接已断开')
})

// 监听新页面创建
browser.on('targetcreated', (target) => {
  console.log('新目标已创建:', target.url())
})
```

### 进程事件数据

#### process-exit / process-close

这两个事件都会接收一个包含以下属性的对象：

```typescript
{
  code: number | null,    // 进程退出码
  signal: string | null   // 导致进程退出的信号（如 'SIGTERM'）
}
```

#### process-error

接收一个 Error 对象，包含错误的详细信息。

## API 参考

### ChromeBrowser

- `wsEndpoint()`: 获取 WebSocket 端点 URL
- `close()`: 关闭浏览器和所有页面
- `pages()`: 获取所有打开的页面
- `newPage()`: 创建新页面
- `process()`: 获取 Chrome 进程对象
- `on(event, listener)`: 添加事件监听器
- `off(event, listener)`: 移除事件监听器

### ChromePage

- `goto(url, options?)`: 导航到指定 URL
- `url()`: 获取当前页面 URL
- `title()`: 获取页面标题
- `close()`: 关闭页面
- `evaluate(fn, ...args)`: 在页面上下文中执行函数
- `screenshot(options?)`: 截取页面截图

## 注意事项

1. 进程事件只在通过 `launch()` 启动的浏览器实例上可用
2. 通过 `connect()` 连接的浏览器不会触发进程相关事件
3. `process-exit` 和 `process-close` 事件通常会同时触发
4. 在进程异常退出时，可能只会触发 `process-exit` 事件 
