import customProtocolCheck from 'custom-protocol-check'

let promiseResolvers: PromiseWithResolvers<boolean> | null = null
let isAppInstalled = false
let lastCheckTime = 0

export function detectCustomProtocol(protocol: string) {
  if (promiseResolvers) {
    return promiseResolvers.promise
  }

  if (Date.now() - lastCheckTime < 5000) {
    return Promise.resolve(isAppInstalled)
  }

  promiseResolvers = Promise.withResolvers<boolean>()
  const { promise, resolve } = promiseResolvers

  customProtocolCheck(
    protocol,
    () => {
      console.debug('Custom protocol not found.')
      isAppInstalled = false
      resolve(false)
      promiseResolvers = null
      lastCheckTime = Date.now()
    },
    () => {
      console.debug('Custom protocol found and opened the file successfully.')
      isAppInstalled = true
      resolve(true)
      promiseResolvers = null
      lastCheckTime = Date.now()
    },
    5000,
  )

  return promise
}
