import { BrowserWindow, screen } from "electron";

const winXYMap = new Map<number, { x: number; y: number, intervalId: NodeJS.Timeout }>();

export function startMoveWindow(win: BrowserWindow) {
  const winPosition = win.getPosition()
  //开始时鼠标位置
  const cursorPosition = screen.getCursorScreenPoint()

  if (winXYMap.has(win.id)) {
    clearInterval(winXYMap.get(win.id)!.intervalId)
  }

  if (!winXYMap.has(win.id)) {
    win.on('blur', () => {
      clearInterval(winXYMap.get(win.id)?.intervalId)
    })
    win.on('focus', () => {
      if (winXYMap.has(win.id)) {
        clearInterval(winXYMap.get(win.id)?.intervalId)
      }
    })
    win.on('close', () => {
      clearInterval(winXYMap.get(win.id)?.intervalId)
      winXYMap.delete(win.id)
    })
  }

  winXYMap.set(win.id, {
    x: cursorPosition.x - winPosition[0],
    y: cursorPosition.y - winPosition[1],
    intervalId: setInterval(() => {
      refreshWinPosition(win)
    }, 20)
  })
}

function refreshWinPosition(win: BrowserWindow) {
  //移动后鼠标位置
  const cursorPosition = screen.getCursorScreenPoint()
  if (!winXYMap.has(win.id)) return

  const { x, y } = winXYMap.get(win.id)!
  //设置窗口位置
  win.setPosition(cursorPosition.x - x, cursorPosition.y - y, true)
}


export function stopMoveWindow(win: BrowserWindow) {
  clearInterval(winXYMap.get(win.id)?.intervalId)
}
