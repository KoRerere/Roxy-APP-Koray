const puppeteer = require('puppeteer-core')
const crypto = require('crypto')
const { copyFile, mkdir } = require('fs/promises')

function generateUUID() {
  return crypto.randomUUID()
}

const username = 'Administrator'

async function launchBrowser(index) {
  const uuid = generateUUID()
  // console.log('生成的 UUID:', uuid)

  const baseDir = `C:\\Users\\${username}\\AppData\\Roaming\\roxybrowserdev`
  const userDataDir = `${baseDir}\\browser-cache\\${uuid}`
  const lumiConfPath = `${baseDir}\\browser-cache\\${uuid}\\lumi.conf`

  await mkdir(userDataDir, { recursive: true })
  await copyFile('./lumi.conf', lumiConfPath)

  const browser = await puppeteer.launch({
    headless: false,
    ignoreDefaultArgs: true,
    defaultViewport: null,
    // executablePath: "/Users/thorn/Library/Application Support/RoxyBrowser/chrome-bin/130/RoxyChrome.app/Contents/MacOS/RoxyChrome",
    executablePath: `${baseDir}\\chrome-bin\\135\\RoxyChrome.exe`,
    args: [
      '--disable-background-mode',
      '--disable-popup-blocking',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      '--use-mock-keychain',
      `--user-data-dir=${userDataDir}`,
      // '--window-position=0,0',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // 'http://127.0.0.1:45535/dashboard?id=a5c079130076f55cf924a319328186f8',
      // '--load-extension=/Users/thorn/Library/Application Support/RoxyBrowser/browser-cache/RoxyExtensions/w_5/nhkjnlcggomjhckdeamipedlomphkepc',
      // '--window-position=0,0',
      // '--window-size=1520,1032',
      '--start-maximized',
      `https://baidu.com/?index=${index}`
    ],
  });

}

; (async () => {
  for (let i = 0; i < 100; i++) {
    console.time(`launchBrowser ${i + 1}`)
    await launchBrowser(i + 1)
    console.timeEnd(`launchBrowser ${i + 1}`)
  }

  setTimeout(() => {
    process.exit(0)
  }, 5000)
})();
