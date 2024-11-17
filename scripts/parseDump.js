const minidump = require('minidump')
const fs = require('node:fs')
const path = require('node:path')

const symbolPaths = path.join(__dirname, 'electron-v22.3.27-win32-x64-symbols/breakpad_symbols')
const minidumpFilePath = path.join(__dirname, '72726093-211c-44b2-853c-06a581f7a3fd.dmp')

minidump.walkStack(minidumpFilePath, symbolPaths, (error, result) => {
  fs.writeFileSync(path.join(__dirname, 'user.txt'), result.toString())
})
