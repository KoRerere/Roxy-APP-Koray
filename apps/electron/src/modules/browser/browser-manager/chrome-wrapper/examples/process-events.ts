/**
 * Chrome 进程事件监听示例
 */

import { launch } from '../launcher'

async function example() {
    // 启动浏览器
    const browser = await launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--no-sandbox'],
        headless: false
    })

    console.log('浏览器已启动')

    // 监听进程退出事件
    browser.on('process-exit', ({ code, signal }) => {
        console.log('Chrome 进程已退出', {
            exitCode: code,
            signal: signal
        })
    })

    // 监听进程关闭事件
    browser.on('process-close', ({ code, signal }) => {
        console.log('Chrome 进程已关闭', {
            exitCode: code,
            signal: signal
        })
    })

    // 监听进程错误事件
    browser.on('process-error', (error) => {
        console.error('Chrome 进程错误:', error)
    })

    // 监听断开连接事件
    browser.on('disconnected', () => {
        console.log('与浏览器的连接已断开')
    })

    // 监听目标创建事件
    browser.on('targetcreated', (target) => {
        console.log('新目标已创建:', target.url())
    })

    // 监听目标销毁事件
    browser.on('targetdestroyed', (target) => {
        console.log('目标已销毁:', target.url())
    })

    // 创建一个新页面
    const page = await browser.newPage()
    await page.goto('https://example.com')

    console.log('页面已加载，等待 10 秒...')

    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 10000))

    // 关闭浏览器
    console.log('正在关闭浏览器...')
    await browser.close()
}

// 处理未捕获的错误
process.on('unhandledRejection', (error) => {
    console.error('未处理的 Promise 拒绝:', error)
    process.exit(1)
})

// 运行示例
example().catch(console.error)
