import type { Configuration } from 'electron-builder'
import { build, Platform } from 'electron-builder'
import { cpSync, rmSync } from 'node:fs'
import path from 'node:path'
import { exit, platform } from 'node:process'
import { notarizeMac } from './notarize-mac'

const version = process.env.VITE_APP_VERSION
const isDev = process.env.NODE_ENV === 'development'
console.log('是否是测试环境：', isDev)
console.log('APP 版本号：', version)

const workDir = path.join(__dirname, '../')

cpSync(path.join(workDir, '../web/dist'), path.join(workDir, './dist/web'), {
  recursive: true,
})
cpSync(path.join(workDir, '../preload/dist'), path.join(workDir, './dist/preload'), { recursive: true })

const options: Configuration = {
  artifactName: '${productName}_${arch}_${version}.${ext}',
  appId: isDev ? 'com.roxybrowser.app' : 'com.lumi.app',
  productName: 'Roxybrowser',
  copyright: 'Roxybrowser',
  asar: true,
  extraMetadata: {
    version,
    name: 'Roxybrowser',
    main: 'dist/main.cjs',
  },
  directories: {
    output: 'out',
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
    ...(!isDev
      ? {
        verifyUpdateCodeSignature: false,
        signingHashAlgorithms: [
          'sha256',
          'sha1',
        ],
        signDlls: false,
        rfc3161TimeStampServer: 'http://timestamp.digicert.com',
        certificateFile: './pfx/linkv.pfx',
        certificatePassword: '0000',
      }
      : {}),
  },
  nsis: {
    installerSidebar: './buildResources/installerSidebar.bmp',
    uninstallerSidebar: './buildResources/uninstallerSidebar.bmp',
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: './logo.ico',
    uninstallerIcon: './logo.ico',
    installerHeaderIcon: './logo.ico',
    installerHeader: './logo.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'roxybrowser',
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
    entitlements: 'buildResources/entitlements.mac.plist',
    entitlementsInherit: 'buildResources/entitlements.mac.plist',
    identity: 'LINKV TECH PTE. LTD. (GLM223L5MF)',
    notarize: false,
  },

  linux: {
    desktop: {
      StartupNotify: 'false',
      Encoding: 'UTF-8',
      MimeType: 'x-scheme-handler/deeplink',
    },
    target: ['AppImage', 'rpm', 'deb'],
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
    const outDir = path.join(workDir, 'out')
    console.log('\x1B[32m', `打包完成🎉🎉🎉你要的都在 ${outDir} 目录里🤪🤪🤪`)
  })
  .catch((error) => {
    console.log('\x1B[31m', '打包失败，错误信息：', error)
    exit(1)
  })
