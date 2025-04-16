const puppeteer = require('puppeteer-core')

const createCdpSesson = async (browser) => {
  let pages = await browser.pages();
  return cdpSession = await pages[0].target().createCDPSession();
}

  ; (async () => {
    const browser = await puppeteer.launch({
      headless: false,
      ignoreDefaultArgs: true,
      defaultViewport: null,
      // executablePath: "/Users/thorn/Library/Application Support/RoxyBrowser/chrome-bin/130/RoxyChrome.app/Contents/MacOS/RoxyChrome",
      executablePath: "C:\\Users\\Administrator\\AppData\\Roaming\\roxybrowserdev\\chrome-bin\\135\\RoxyChrome.exe",
      args: [
        '--disable-background-mode',
        '--disable-popup-blocking',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        '--use-mock-keychain',
        '--user-data-dir=C:\\Users\\Administrator\\AppData\\Roaming\\roxybrowserdev\\browser-cache\\b71c4480a1d81860748acc9636fe7753',
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
