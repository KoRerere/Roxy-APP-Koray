import initWasm, { initSync } from './roxy_crypto_wasm.js'
import wasmAssetUrl from '../pkg/roxy_crypto_wasm_bg.wasm?url'

let initPromise: Promise<void> | null = null

function getWasmPath(): URL {
  return new URL('./roxy_crypto_wasm_bg.wasm', import.meta.url)
}

async function loadWasmBytes(): Promise<ArrayBuffer> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { existsSync, readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    let wasmPath = fileURLToPath(getWasmPath())
    // Electron 打包后 WASM 在 app.asar.unpacked
    if (wasmPath.includes('app.asar')) {
      const unpackedPath = wasmPath.replace('app.asar', 'app.asar.unpacked')
      if (existsSync(unpackedPath)) {
        wasmPath = unpackedPath
      }
    }
    const buffer = readFileSync(wasmPath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }

  const response = await fetch(wasmAssetUrl)
  return response.arrayBuffer()
}

export function initCrypto(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const bytes = await loadWasmBytes()
      if (typeof process !== 'undefined' && process.versions?.node) {
        initSync({ module: bytes })
      }
      else {
        await initWasm(bytes)
      }
    })()
  }
  return initPromise
}

export async function ensureCryptoReady(): Promise<void> {
  await initCrypto()
}
