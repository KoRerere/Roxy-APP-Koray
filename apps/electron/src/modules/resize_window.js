const puppeteer = require("puppeteer-core");
const create_cdp_session = async(browser) => {
    let pages = await browser.pages()
    return await pages[0].target().createCDPSession();
}

const  resizeWindow = async(cdpSesssion,height,width,left,top) => {
    // 获取windowid
    const {windowId} = await cdpSesssion.send('Browser.getWindowForTarget');
    // 配置窗口位置信息
    var bounds = {left:left,top:top,height, width}
    await cdpSesssion.send('Browser.setWindowBounds', {
      bounds: bounds,
      windowId
    });    

    var new_bounds = await cdpSesssion.send('Browser.getWindowBounds', {
        windowId
      });    
    
    // 返回新的位置信息
    return {
        left:new_bounds.bounds.left,
        top:new_bounds.bounds.top,
        height:new_bounds.bounds.height,
        width:new_bounds.bounds.width
    }
  }
   
(async()=> {
    let browser_list = []
    let window_count = 10
    for (var i = 0 ; i < window_count; i++)  {
        const browser = await puppeteer.launch({
            executablePath:"C:\\Users\\walontian\\AppData\\Roaming\\lumibrowser\\chrome-bin\\117\\lumibrowser.exe",
            headless:false,
            defaultViewport:null,
            args:[
                "--disable-background-mode", 
                "--disable-popup-blocking",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-background-mode",
                "--remote-debugging-port=0",
                "--use-mock-keychain",
                "--fdebug=1",
                "--load-extension=",
                "--window-position=0,0",
                "--window-size=1000,1000",
                "--user-data-dir=C:\\Users\\walontian\\AppData\\Roaming\\lumibrowser\\lumicache\\4e1a4f2i301bb3" + i],
            ignoreDefaultArgs:true,
            debuggingPort:0,
            timeout:6000
        });
        browser_list.push(browser)
    }

    // 从左到右排列
   // 最低高度52
    let height = 52;

    // 最低宽度203
    let width = 203;
    let top = 0;
    let left = 0;
    let screen_width = 1792;
    let screen_height = 1120;
    for (var i = 0; i < window_count; i++)  {
        var cdp_session = await create_cdp_session(browser_list[i])
        let new_pos = await resizeWindow(cdp_session,height,width,left,top)
        console.log(i,new_pos)
        left = new_pos.left + new_pos.width + 5;
        top = new_pos.top

        // 超出屏幕宽度，自动换行
        if (left + width > screen_width) {
            left = 0
            top = new_pos.top + new_pos.height
        }

        if (top + height > screen_height) {
            // 高度超出了，不排列
            break
        }
    }
})()
