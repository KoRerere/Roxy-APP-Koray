import type { Configuration } from 'electron-builder'
import type { CopySyncOptions } from 'node:fs'
import { build, Platform } from 'electron-builder'
import { cpSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { exit, platform } from 'node:process'
import { notarizeMac } from './notarize-mac.mts'

const version = process.env.VITE_APP_VERSION
const isDev = process.env.NODE_ENV !== 'production'
const skipCodeSigning = isDev && process.platform === 'win32' ? true : Boolean(process.env.SKIP_CODE_SIGNING) // 是否跳过代码签名
const appName = isDev ? 'RoxyBrowserDev' : 'RoxyBrowser'
const shortcutName = isDev ? 'Roxy Browser Dev' : 'Roxy Browser'

console.log('是否是测试环境：', isDev, appName)
console.log('是否跳过代码签名：', skipCodeSigning)
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

// ============================================================================
// 根据环境动态生成安装脚本
// ============================================================================

// 根据环境设置配置
const config = isDev
  ? {
    REPORT_DOMAINS: 'https://lumitest.lumibrowser.com',
    REPORT_API_PATH: '/app_tracking_event',
    APP_NAME: 'RoxyBrowserDev'
  }
  : {
    REPORT_DOMAINS: 'https://hz.gate.roxybrowser.cn|https://sg.gate.roxybrowser.net|https://us.gate.roxybrowser.net',
    REPORT_API_PATH: '/app_tracking_event',
    APP_NAME: 'RoxyBrowser'
  }

const extraResources: NonNullable<Configuration['extraResources']> = [
  {
    from: 'node_modules/font-list',
    to: 'node_modules/font-list',
  },
]

// 处理 macOS PKG 脚本
if (platform === 'darwin') {
  const templatePath = path.join(workDir, 'buildResources/postinstall.template')
  const template = readFileSync(templatePath, 'utf-8')

  const script = template
    .replaceAll('{{REPORT_DOMAINS}}', config.REPORT_DOMAINS)
    .replaceAll('{{REPORT_API_PATH}}', config.REPORT_API_PATH)
    .replaceAll('{{APP_NAME}}', config.APP_NAME)

  const outputPath = path.join(workDir, 'buildResources/pkg-scripts/postinstall')
  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, script)
  chmodSync(outputPath, 0o755)

  console.log(`✅ 已生成 macOS 安装脚本 (${isDev ? '开发' : '生产'}环境)`)
}

// 处理 Windows NSIS 脚本
if (platform === 'win32') {
  const templatePath = path.join(workDir, 'buildResources/installer.template.nsh')
  const template = readFileSync(templatePath, 'utf-8')

  const script = template
    .replaceAll('{{REPORT_DOMAINS}}', config.REPORT_DOMAINS)
    .replaceAll('{{REPORT_API_PATH}}', config.REPORT_API_PATH)

  const outputPath = path.join(workDir, 'buildResources/installer.nsh')
  writeFileSync(outputPath, script)

  console.log(`✅ 已生成 Windows 安装脚本 (${isDev ? '开发' : '生产'}环境)`)
}

// 处理 Linux deb 脚本
if (platform === 'linux') {
  const linuxDir = path.join(workDir, 'buildResources/linux')
  const outputLinuxDir = path.join(workDir, 'buildResources/linux-scripts')
  mkdirSync(outputLinuxDir, { recursive: true })
  const linuxGeneratedDir = path.join(linuxDir, 'generated')
  mkdirSync(linuxGeneratedDir, { recursive: true })

  // 配置变量
  const wrapperFileName = 'roxybrowser-update-wrapper.sh'
  const linuxConfig = {
    APP_NAME: appName,
    VENDOR_NAME: isDev ? 'Roxy Browser Dev' : 'Roxy Browser',
    ICON_NAME: appName.toLowerCase(),
    POLICY_FILENAME: isDev ? 'com.roxybrowser.dev.policy' : 'com.roxybrowser.policy',
    WRAPPER_FILENAME: wrapperFileName,
    WRAPPER_POLICY_PATH: `/opt/${appName}/resources/${wrapperFileName}`,
    WRAPPER_LOG_PATH: `/var/log/${appName.toLowerCase()}-update-wrapper.log`,
  }

  // 生成 policy 文件
  const policyTemplatePath = path.join(linuxDir, 'com.roxybrowser.policy.template')
  const policyTemplate = readFileSync(policyTemplatePath, 'utf-8')
  const policyContent = policyTemplate
    .replaceAll('{{APP_NAME}}', linuxConfig.APP_NAME)
    .replaceAll('{{VENDOR_NAME}}', linuxConfig.VENDOR_NAME)
    .replaceAll('{{ICON_NAME}}', linuxConfig.ICON_NAME)
    .replaceAll('{{WRAPPER_PATH}}', linuxConfig.WRAPPER_POLICY_PATH)

  // 将 policy 文件写入生成目录，稍后通过 extraResources 打包到 resources 根目录
  const policyOutputPath = path.join(linuxGeneratedDir, 'com.roxybrowser.policy')
  writeFileSync(policyOutputPath, policyContent)

  extraResources.push({
    from: policyOutputPath,
    to: 'com.roxybrowser.policy',
  })

  // 生成 pkexec wrapper
  const wrapperTemplatePath = path.join(linuxDir, 'update-wrapper.sh')
  const wrapperTemplate = readFileSync(wrapperTemplatePath, 'utf-8')
  const wrapperContent = wrapperTemplate
    .replaceAll('{{APP_NAME}}', linuxConfig.APP_NAME)
    .replaceAll('{{WRAPPER_LOG_PATH}}', linuxConfig.WRAPPER_LOG_PATH)
  const wrapperOutputPath = path.join(linuxGeneratedDir, linuxConfig.WRAPPER_FILENAME)
  writeFileSync(wrapperOutputPath, wrapperContent)
  chmodSync(wrapperOutputPath, 0o755)

  extraResources.push({
    from: wrapperOutputPath,
    to: linuxConfig.WRAPPER_FILENAME,
  })

  // 生成 afterInstall 脚本
  const afterInstallTemplate = readFileSync(path.join(linuxDir, 'afterInstall.sh'), 'utf-8')
  const afterInstallContent = afterInstallTemplate
    .replaceAll('{{APP_NAME}}', linuxConfig.APP_NAME)
    .replaceAll('{{POLICY_FILENAME}}', linuxConfig.POLICY_FILENAME)
  writeFileSync(path.join(outputLinuxDir, 'afterInstall.sh'), afterInstallContent)
  chmodSync(path.join(outputLinuxDir, 'afterInstall.sh'), 0o755)

  console.log(`✅ 已生成 Linux deb 脚本和 policy 文件 (${isDev ? '开发' : '生产'}环境)`)
}

console.log(`📡 上报域名: ${config.REPORT_DOMAINS}`)
console.log(`📡 API 路径: ${config.REPORT_API_PATH}`)

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
    main: 'dist/main.mjs',
  },
  directories: {
    output: '../../out',
    buildResources: 'buildResources',
  },
  extraResources,
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

  // "store" | "normal" | "maximum". - For testing builds, use 'store' to reduce build time significantly.
  compression: 'normal',
  removePackageScripts: true,

  // 根据环境变量决定是否跳过签名后的公证流程
  afterSign: skipCodeSigning ? undefined : async (context) => {
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
    signtoolOptions: skipCodeSigning ? undefined : {
      rfc3161TimeStampServer: 'http://timestamp.digicert.com',
      certificateFile: './pfx/linkv.pfx',
      certificatePassword: '0000',
    }
  },
  nsis: {
    installerSidebar: './buildResources/installerSidebar.bmp',
    uninstallerSidebar: './buildResources/uninstallerSidebar.bmp',
    // 使用动态生成的 NSIS 脚本
    include: './buildResources/installer.nsh',
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
    sign: !skipCodeSigning, // 根据环境变量决定是否签名
  },
  mac: {
    target: [
      {
        target: 'default',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'pkg',
        arch: ['x64', 'arm64'],
      },
    ],
    icon: 'logo.icns',
    hardenedRuntime: !skipCodeSigning, // 根据环境变量决定是否需要强化运行时
    gatekeeperAssess: false,
    entitlements: skipCodeSigning ? undefined : 'buildResources/entitlements.plist', // 根据环境变量决定是否需要沙盒权限
    entitlementsInherit: skipCodeSigning ? undefined : 'buildResources/entitlements.plist',
    identity: skipCodeSigning ? '-' : 'LINKV TECH PTE. LTD. (GLM223L5MF)', // 根据环境变量决定使用 ad-hoc 签名或证书签名
    notarize: false,
  },
  pkg: {
    scripts: 'pkg-scripts',
    isRelocatable: false,
    identity: skipCodeSigning ? '-' : 'LINKV TECH PTE. LTD. (GLM223L5MF)', // 根据环境变量决定使用 ad-hoc 签名或证书签名
  },
  linux: {
    icon: 'logo.icns',
    target: 'deb',
    category: 'Network',
    synopsis: isDev ? 'Roxy Browser Dev' : 'Roxy Browser',
    description: 'Premier Antidetect Browser Streamline Your Workflow Effortlessly',
    // Linux 启动参数（会添加到 .desktop 文件的 Exec 字段中）
    executableArgs: ['--no-sandbox --disable-setuid-sandbox'],
    desktop: {
      entry: {
        Name: shortcutName,
        Comment: isDev ? 'Roxy Browser Dev' : 'Roxy Browser',
        Categories: 'Network;WebBrowser;',
        MimeType: 'x-scheme-handler/roxybrowser;',
      }
    },
  },
  deb: {
    // 安装后执行的脚本（用于安装 polkit policy 文件）
    afterInstall: 'buildResources/linux-scripts/afterInstall.sh',
    // 依赖项
    depends: [
      'libgtk-3-0',
      'libnotify4',
      'libnss3',
      'libxss1',
      'libxtst6',
      'xdg-utils',
      'libatspi2.0-0',
      'libuuid1',
      'libsecret-1-0',
    ],
  },
  // publish: [
  //   {
  //     provider: 'github',
  //     releaseType: 'draft',
  //     // private: true,
  //   },
  // ],
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
    if (platform === 'darwin') {
      import('./notarytool.mts')
    }
  })
  .catch((error) => {
    console.log('\x1B[31m', '打包失败，错误信息：', error)
    exit(1)
  })
