#!/usr/bin/env node

// 获取命令行参数
const args = process.argv.slice(2)

console.log('命令行参数:', args)

// 示例：处理命令行参数
args.forEach((arg, index) => {
  console.log(`参数 ${index + 1}: ${arg}`)
})

// 示例：解析命令行参数
const options = args.reduce((acc, arg) => {
  const [key, value] = arg.split('=')
  acc[key] = value || true // 如果没有指定值，则默认为 true
  return acc
}, {} as Record<string, any>)

console.log('解析后的参数:', options)

// 示例：根据参数执行不同操作
if (options['--help']) {
  console.log('显示帮助信息')
}
else if (options['--version']) {
  console.log('显示版本信息')
}
else {
  console.log('执行其他操作')
}
