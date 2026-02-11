// build-inno-updater.js
// Node.js script to build a tiny Win32 UI exe using MSVC without manually opening Developer Command Prompt.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts })
  return r
}

function quote(s) {
  // cmd.exe quoting
  if (s.includes('"'))
    s = s.replaceAll('"', '\\"')
  if (/\s/.test(s))
    return `"${s}"`
  return s
}

function findVswhere() {
  const candidates = [
    // standard location
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
    // sometimes on ProgramFiles
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p))
      return p
  }
  return null
}

function findVsInstallPath(vswherePath) {
  const args = [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath',
  ]
  const r = run(vswherePath, args)
  if (r.status !== 0)
    return null
  const out = (r.stdout || '').trim()
  return out || null
}

function findVsDevCmd(installPath) {
  const candidates = [
    path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat'),
    // fallback: older variants sometimes have this
    path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p))
      return p
  }
  return null
}

function main() {
  const cwd = path.join(import.meta.dirname)

  // Inputs (you can edit these defaults)
  const src = path.resolve(cwd, 'inno_updater_stub.c')
  const out = path.resolve(cwd, 'RoxyBrowserUpdater.exe')

  if (!fs.existsSync(src)) {
    console.error(`❌ Source file not found: ${src}`)
    console.error(`   Please run this script in the folder containing inno_updater_stub.c`)
    process.exit(1)
  }

  const vswhere = findVswhere()
  if (!vswhere) {
    console.error('❌ vswhere.exe not found.')
    console.error('   Install "Visual Studio Installer" or Visual Studio Build Tools (C++ workload).')
    process.exit(1)
  }

  const installPath = findVsInstallPath(vswhere)
  if (!installPath) {
    console.error('❌ Visual Studio with C++ toolchain not found (VC.Tools.x86.x64).')
    console.error('   Open "Visual Studio Installer" and install: Desktop development with C++')
    process.exit(1)
  }

  const vsDevCmd = findVsDevCmd(installPath)
  if (!vsDevCmd) {
    console.error('❌ VsDevCmd.bat not found under installation path:')
    console.error(`   ${installPath}`)
    process.exit(1)
  }

  // Build commands (same as你之前那条 cl 命令)
  // We'll output exe with a fixed name via /Fe:
  const clCmd = [
    'cl',
    '/nologo',
    '/utf-8',
    '/O1',
    '/Os',
    '/MD',
    '/GS-',
    quote(src),
    `/Fe:${quote(out)}`,
    '/link',
    '/SUBSYSTEM:WINDOWS',
    '/INCREMENTAL:NO',
    '/OPT:REF',
    '/OPT:ICF',
    'dwmapi.lib',
    'user32.lib',
    'gdi32.lib',
    'comctl32.lib',
    'shell32.lib',
  ].join(' ')

  // Write a temp .cmd to ensure proper quoting & environment setup.
  const tempCmd = path.join(cwd, `.build_inno_updater_${Date.now()}.cmd`)
  
  // Icon resource
  const iconSrc = path.resolve(cwd, '../../buildResources/logo.ico')
  const iconDest = path.join(cwd, 'logo.ico')
  try {
    fs.copyFileSync(iconSrc, iconDest)
  } catch (e) {
    console.warn('⚠️ Could not copy logo.ico from buildResources. Icon may be missing.')
  }
  
  const rcCmd = `rc /nologo /fo updater.res updater.rc`
  
  const script = [
    '@echo off',
    'setlocal',
    `call ${quote(vsDevCmd)} -arch=amd64 -host_arch=amd64`,
    'if errorlevel 1 exit /b 1',
    rcCmd, // Compile resource
    'if errorlevel 1 exit /b 1', 
    `${clCmd} updater.res`, // Link resource
    'exit /b %errorlevel%',
  ].join('\r\n')

  fs.writeFileSync(tempCmd, script, 'utf8')

  console.log('▶ Using:', vsDevCmd)
  console.log('▶ Building:', path.basename(out))
  const r = run('cmd.exe', ['/d', '/s', '/c', tempCmd], { cwd })

  // Cleanup temp cmd
  try { fs.unlinkSync(tempCmd) }
  catch {}
  try { fs.unlinkSync(iconDest) } catch {} // Cleanup copied icon
  try { fs.unlinkSync(path.join(cwd, 'updater.res')) } catch {} // Cleanup .res file

  if (r.stdout)
    process.stdout.write(r.stdout)
  if (r.stderr)
    process.stderr.write(r.stderr)

  if (r.status !== 0) {
    console.error(`❌ Build failed with exit code ${r.status}`)
    process.exit(r.status)
  }

  if (fs.existsSync(out)) {
    const size = fs.statSync(out).size
    console.log(`✅ Done: ${out}`)
    console.log(`   Size: ${(size / 1024).toFixed(1)} KB`)
  }
  else {
    console.error('❌ Build finished but output not found:', out)
    process.exit(1)
  }
}

main()
