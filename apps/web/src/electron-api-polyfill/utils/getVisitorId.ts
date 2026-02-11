import type { Agent } from '@fingerprintjs/fingerprintjs'

let visitorId: string
let fpPromise: Promise<Agent>

export async function getVisitorId() {
  if (visitorId) {
    return visitorId
  }

  const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
  // 加载指纹 agent
  fpPromise ||= FingerprintJS.default.load()

  return fpPromise
    .then(fp => fp.get())
    .then((result) => {
      // This is the visitor identifier:
      visitorId = result.visitorId
      console.debug('getVisitorId', visitorId)
      return visitorId
    })
}

setTimeout(getVisitorId)
