/**
 * 测试 disconnected 事件不会重复触发
 */

import { launch } from '../launcher'

async function testDisconnectedEvent() {
    console.log('启动测试：验证 disconnected 事件只触发一次')

    const browser = await launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--no-sandbox'],
        headless: true
    })

    let disconnectedCount = 0
    let processExitCount = 0
    let processCloseCount = 0

    // 监听各种事件并计数
    browser.on('disconnected', () => {
        disconnectedCount++
        console.log(`disconnected 事件触发次数: ${disconnectedCount}`)
    })

    browser.on('process-exit', ({ code, signal }) => {
        processExitCount++
        console.log(`process-exit 事件触发 (第 ${processExitCount} 次)`, { code, signal })
    })

    browser.on('process-close', ({ code, signal }) => {
        processCloseCount++
        console.log(`process-close 事件触发 (第 ${processCloseCount} 次)`, { code, signal })
    })

    // 创建一个页面
    const page = await browser.newPage()
    await page.goto('about:blank')

    console.log('\n正在关闭浏览器...')
    await browser.close()

    // 等待一下确保所有事件都已触发
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('\n===== 测试结果 =====')
    console.log(`disconnected 事件触发总次数: ${disconnectedCount}`)
    console.log(`process-exit 事件触发总次数: ${processExitCount}`)
    console.log(`process-close 事件触发总次数: ${processCloseCount}`)

    if (disconnectedCount === 1) {
        console.log('✅ 测试通过：disconnected 事件只触发了一次')
    } else {
        console.log('❌ 测试失败：disconnected 事件触发了多次')
    }
}

// 运行测试
testDisconnectedEvent().catch(console.error)
