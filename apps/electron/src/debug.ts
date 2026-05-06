import { browserManager } from '/@/modules/browser'
import { store } from '/@/modules/store'
import * as utils from '/@/utils'

// 密码为 roxy-debug
const password = 'cm94eS1kZWJ1Zw=='

let debugObj

/** 主要用于调试 */
export function initDebug() {
  class Test {
    #password

    constructor(password) {
      this.#password = atob(password)
    }

    getSecret(pwd) {
      if (pwd === this.#password) {
        return getDebugObj()
      }
    }
  }

  const test = new Test(password)
  globalThis.$$test = (p) => {
    return test.getSecret(p)
  }
}

function getDebugObj() {
  debugObj ||= {
    store,
    browserManager,
    utils,
  }

  return debugObj
}
