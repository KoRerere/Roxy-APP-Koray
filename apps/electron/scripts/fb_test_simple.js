const puppeteer = require('puppeteer-core')
const { readFile, unlink } = require('fs/promises')

// 打印 puppeteer 版本
const packageJson = require('puppeteer-core/package.json')
console.log('Puppeteer version:', packageJson.version)

const createCdpSesson = async (browser) => {
  return browser.target().createCDPSession()
}

  ; (async () => {
    const browser = await puppeteer.launch({
      headless: false,
      ignoreDefaultArgs: true,
      defaultViewport: null,
      // executablePath: "/Users/thorn/Library/Application Support/RoxyBrowser/chrome-bin/130/RoxyChrome.app/Contents/MacOS/RoxyChrome",
      executablePath: "C:\\Users\\Administrator\\AppData\\Roaming\\roxybrowserdev\\chrome-bin\\109\\RoxyChrome.exe",
      args: [
        '--disable-background-mode',
        '--disable-popup-blocking',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        '--use-mock-keychain',
        '--user-data-dir=C:\\Users\\Administrator\\AppData\\Roaming\\roxybrowserdev\\browser-cache\\babc0884b42f23fc55e7f5e93cd9b6f2',
        // '--window-position=0,0',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // 'http://127.0.0.1:45535/dashboard?id=a5c079130076f55cf924a319328186f8',
        // '--load-extension=/Users/thorn/Library/Application Support/RoxyBrowser/browser-cache/RoxyExtensions/w_5/nhkjnlcggomjhckdeamipedlomphkepc',
        // '--window-position=0,0',
        // '--window-size=1520,1032',
        '--start-maximized',
        'https://baidu.com/'
      ],
    });


    const cdp = await createCdpSesson(browser)

    browser.on('disconnected', async () => {
      console.log('browser disconnected')
      try {
        const roxyTabs = await readFile('C:\\Users\\Administrator\\AppData\\Roaming\\roxybrowserdev\\browser-cache\\babc0884b42f23fc55e7f5e93cd9b6f2\\roxy_tabs', 'utf8')
        console.log('roxyTabs', decodeURIComponent(roxyTabs))
        await unlink('C:\\Users\\Administrator\\AppData\\Roaming\\roxybrowserdev\\browser-cache\\babc0884b42f23fc55e7f5e93cd9b6f2\\roxy_tabs')
      } catch (error) {
        console.log('roxyTabs 文件不存在 跳过', error)
      }
    })

    setTimeout(() => {
      // browser.close().then(() => {
      //   console.log('browser closed by browser.close')
      // })
      cdp.send('Browser.close').then(() => {
        console.log('browser closed by cdp.send')
      })
    }, 10000)

  })();
// await browser.pages()[0]
// let cdp = await createCdpSesson(browser)
// browser.on("targetchanged", async (target) => {

// })
// browser.on("targetcreated", async (target) => {
//     let rsp = await cdp.send("Storage.getCookies")
//     //console.log(rsp)
// })
// browser.on("targetdestroyed", async (target) => {
//     let rsp = await cdp.send("Storage.getCookies")
//     //console.log(rsp)

// })
// let pages = await browser.pages()
// for (let page of pages) {
//     if (page.target().type() == "page") {
//         console.log("goto -->", page.target().url())
//         page.goto(page.target().url())
//     }
// }
