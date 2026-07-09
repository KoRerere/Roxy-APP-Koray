import { decryptAESGCM, decryptLocalPassword, encryptAESGCM, encryptAESGCMLocal, initCrypto } from '../packages/roxy-crypto/dist/index.js'

await initCrypto()

const payload = { foo: 'bar' }
const encrypted = await encryptAESGCM(JSON.stringify(payload))
const decrypted = await decryptAESGCM(encrypted)
if (JSON.stringify(decrypted) !== JSON.stringify(payload)) {
  throw new Error('dist package encrypt/decrypt failed')
}

const local = await encryptAESGCMLocal('secret', 'test@roxy.com')
const localDec = await decryptLocalPassword(local, 'test@roxy.com')
if (localDec !== 'secret') {
  throw new Error('dist package local decrypt failed')
}

// v1 fallback
const v1 = await encryptAESGCM('legacy')
const v1Dec = await decryptLocalPassword(v1, 'any')
if (v1Dec !== 'legacy') {
  throw new Error('dist v1 fallback failed')
}

console.log('dist package tests passed')
