import { enableInspector, ignoreDebugStartupArgs, setupDevToolsGuard } from '/@/modules/devtools-guard'

// 必须先于 enableInspector：命令行带 --inspect 时端口已被 Electron 打开，
// 这里先摘掉，避免下面的开关判断被启动参数绕过
ignoreDebugStartupArgs()

// 在模块加载期注册，早于启动窗口等任何 webContents 的创建
setupDevToolsGuard()

// 打包版默认不开启，enableInspector 内部按开发者工具开关判断，
// 保证正式发布版启动后不监听任何 Node 调试端口
enableInspector()
