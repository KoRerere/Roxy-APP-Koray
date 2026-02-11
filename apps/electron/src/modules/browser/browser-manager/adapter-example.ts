/**
 * 浏览器适配器使用示例
 * 展示如何使用统一的接口启动和操作不同的浏览器
 */

import type { BrowserType } from './adapter'
import { launchBrowser } from './adapter'

async function main() {
  // 选择浏览器类型：'chrome' 或 'firefox'
  const browserType: BrowserType = 'firefox'

  // 根据浏览器类型配置启动选项
  const options = browserType === 'firefox'
    ? {
        executablePath: 'D:\\工作资料\\火狐内核\\RoxyFirefox\\RoxyFirefox.exe',
        userDataDir: 'D:\\工作资料\\火狐内核\\RoxyFirefox\\firefox-user-data-dir',
        args: [],
      }
    : {
        executablePath: 'path/to/chrome.exe',
        args: ['--user-data-dir=path/to/chrome-profile'],
      }

  try {
    // 启动浏览器 - 无论是 Chrome 还是 Firefox，使用相同的接口
    console.log(`Starting ${browserType} browser...`)
    const browser = await launchBrowser(browserType, options)
    console.log(`${browserType} browser started successfully`)

    // 监听浏览器事件
    browser.on('disconnected', () => {
      console.log('Browser disconnected')
    })

    // 创建新页面
    console.log('Creating new page...')
    const page = await browser.newPage()
    console.log('Page created')

    // 导航到网页
    console.log('Navigating to Google...')
    await page.goto('https://www.google.com')
    console.log('Navigation completed')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 搜索 roxybrowser
    console.log('Searching for roxybrowser...')
    await page.evaluate(() => {
      const searchInput = document.querySelector('textarea[name="q"]') as HTMLTextAreaElement
      if (searchInput) {
        searchInput.value = 'roxybrowser'
        const form = searchInput.closest('form')
        if (form) {
          form.submit()
        }
      }
    })
    console.log('Search submitted')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 点击第一个搜索结果（roxybrowser 官网）
    console.log('Looking for roxybrowser official website link...')
    const officialLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.zReHs'))
      const roxyLink = links.find(link =>
        link.href.includes('roxybrowser')
        && (link.href.includes('.com') || link.href.includes('.co')),
      )
      return roxyLink?.href || null
    })

    if (officialLink) {
      console.log('Found official website:', officialLink)
      console.log('Navigating to official website...')
      await page.goto(officialLink)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 获取 h1 标签内容
      console.log('Getting h1 content from official website...')
      const h1Content = await page.evaluate(() => {
        const h1Elements = Array.from(document.querySelectorAll('h1'))
        return h1Elements.map(h1 => h1.textContent?.trim()).filter(Boolean)
      })
      console.log('H1 content:', h1Content)
    }
    else {
      console.log('Could not find official website link in search results')
    }

    // 获取所有页面
    const pages = await browser.pages()
    console.log(`Total pages: ${pages.length}`)

    // 等待一段时间以便查看结果
    console.log('Waiting before closing...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    // 关闭页面
    console.log('Closing page...')
    await page.close()

    // 关闭浏览器
    console.log('Closing browser...')
    await browser.close()
    console.log('Browser closed')
  }
  catch (error) {
    console.error('Error:', error)
  }
}

// 如果直接运行此文件
if (import.meta.main) {
  main().catch(console.error)
}

export { main }
