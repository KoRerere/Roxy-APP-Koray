import type { Configuration } from 'electron-builder'
import type { CopySyncOptions } from 'node:fs'
import { build, Platform } from 'electron-builder'
import { cpSync, rmSync } from 'node:fs'
import path from 'node:path'
import { exit, platform } from 'node:process'
import { notarizeMac } from './notarize-mac'

const version = process.env.VITE_APP_VERSION
const isDev = process.env.NODE_ENV === 'development'
const appName = isDev ? 'RoxyBrowserDev' : 'RoxyBrowser'
const shortcutName = isDev ? 'Roxy Browser Dev' : 'Roxy Browser'

console.log('是否是测试环境：', isDev, appName)
console.log('APP 版本号：', version)

const workDir = path.join(import.meta.dirname, '../')

const copySyncOptions: CopySyncOptions = {
  recursive: true,
  /**
   * 过滤 source map 文件
   */
  filter: src => !src.endsWith('.map') && !src.endsWith('.d.ts'),
}

cpSync(path.join(workDir, '../web/dist'), path.join(workDir, './dist/web'), copySyncOptions)
cpSync(path.join(workDir, '../web/src/locales/langs'), path.join(workDir, './dist/web/locales'), copySyncOptions)
cpSync(path.join(workDir, '../preload/dist'), path.join(workDir, './dist/preload'), copySyncOptions)
cpSync(path.join(workDir, './bin'), path.join(workDir, './dist/bin'), copySyncOptions)

const options: Configuration = {
  artifactName: '${productName}_${arch}_${version}.${ext}',
  appId: isDev ? 'com.roxybrowser.dev.app' : 'com.roxybrowser.app',
  productName: appName,
  copyright: appName,
  asar: true,
  asarUnpack: [
    "dist/web",
    "dist/bin",
  ],
  extraMetadata: {
    version,
    name: appName,
    main: 'dist/main.cjs',
  },
  directories: {
    output: '../../out',
    buildResources: 'buildResources',
  },
  files: [
    'dist',
    'resources',
  ],
  protocols: [
    {
      name: 'roxybrowser',
      schemes: ['roxybrowser'],
    },
  ],

  // "store” | “normal” | "maximum". - For testing builds, use 'store' to reduce build time significantly.
  compression: 'normal',
  removePackageScripts: true,

  afterSign: async (context) => {
    await notarizeMac(context)
  },
  nodeGypRebuild: false,
  buildDependenciesFromSource: false,

  win: {
    icon: 'logo.ico',
    target: [
      {
        target: 'nsis',
        arch: ['ia32', 'x64'],
      },
    ],
    verifyUpdateCodeSignature: false,
    signtoolOptions: isDev ? undefined : {
      rfc3161TimeStampServer: 'http://timestamp.digicert.com',
      certificateFile: './pfx/linkv.pfx',
      certificatePassword: '0000',
    }
  },
  nsis: {
    installerSidebar: './buildResources/installerSidebar.bmp',
    uninstallerSidebar: './buildResources/uninstallerSidebar.bmp',
    // 引入自定义 NSIS 脚本
    // include: './build/installer.nsh',
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: './logo.ico',
    uninstallerIcon: './logo.ico',
    installerHeaderIcon: './logo.ico',
    installerHeader: './logo.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName,
  },
  dmg: {
    sign: true,
  },
  mac: {
    target: [
      {
        target: 'default',
        arch: ['x64', 'arm64'],
      },
    ],
    icon: 'logo.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'buildResources/entitlements.plist', // 沙盒权限
    entitlementsInherit: 'buildResources/entitlements.plist', // 继承的沙盒权限
    identity: 'LINKV TECH PTE. LTD. (GLM223L5MF)',
    notarize: false,
  },
  publish: [
    {
      provider: 'github',
      releaseType: 'draft',
      // private: true,
    },
  ],
}

// 要打包的目标平台
const targetPlatform: Platform = {
  darwin: Platform.MAC,
  win32: Platform.WINDOWS,
  linux: Platform.LINUX,
}[platform]

build({
  targets: targetPlatform.createTarget(),
  config: options,
  publish: process.env.CI ? 'always' : 'never',
})
  .then((result) => {
    console.log(JSON.stringify(result))
    const outDir = path.join(workDir, options.directories!.output!)
    console.log('\x1B[32m', `打包完成🎉🎉🎉你要的都在 ${outDir} 目录里🤪🤪🤪`)
  })
  .catch((error) => {
    console.log('\x1B[31m', '打包失败，错误信息：', error)
    exit(1)
  })
