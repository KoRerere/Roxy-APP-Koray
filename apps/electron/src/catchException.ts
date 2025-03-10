import { crashReporter, dialog } from "electron"

// 禁止弹出错误框
dialog.showErrorBox = function (title, content) {
  // 只记录错误，不显示弹窗
  console.error(`只记录错误，不显示系统弹窗：${title}\n${content}`);
};

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
  // 在这里执行一些清理操作或记录错误日志
})

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason)
  // 在这里执行一些清理操作或记录错误日志
})

// 捕获崩溃信息
crashReporter.start({
  uploadToServer: false,
})

// 方便测试崩溃信息
// setTimeout(() => {
//   process.crash()
// }, 6000)
