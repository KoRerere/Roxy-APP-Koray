function loadAliyunCaptcha() {
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  if ((window as any).initAliyunCaptcha) {
    return
  }

  Reflect.set(window, 'AliyunCaptchaConfig', {
    region: 'cn',
    prefix: '54bekl',
  })

  const script = document.createElement('script')
  script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js'
  script.async = true
  script.onload = () => {
    resolve()
  }
  script.onerror = () => {
    reject(new Error('AliyunCaptcha load failed'))
  }
  document.head.appendChild(script)
  return promise
}

/**
 * 打开验证码
 */

interface Options {
  SceneId: string
  EncryptedSceneId: string
  language?: 'cn' | 'en' | 'tw'
}

export async function openAliyunCaptcha(options: Options) {
  await loadAliyunCaptcha()
  const { promise, resolve } = Promise.withResolvers<string | null>();

  (window as any).initAliyunCaptcha({
    mode: 'popup', // 验证码模式。popup表示要集成的验证码模式为弹出式。无需修改
    slideStyle: {
      width: 360,
      height: 40,
    }, // 滑块验证码样式，支持自定义宽度和高度，单位为px。其中，width最小值为320 px
    language: 'cn', // 验证码语言类型，支持简体中文（cn）、繁体中文（tw）、英文（en）
    ...options,
    success: (captchaVerifyParam: string) => resolve(captchaVerifyParam),
    onClose: () => resolve(null),
    getInstance: (instance: any) => {
      instance.show()
    }, // 绑定验证码实例函数，无需修改
  })

  return promise
}
