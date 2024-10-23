import { isDev } from '/@/utils'

// if (import.meta.hot) {
//   // Prevent full reload, see https://github.com/vitejs/vite/issues/5763#issuecomment-1974235806
//   import.meta.hot.on('vite:beforeFullReload', (payload) => {
//     payload.path = '(WORKAROUND).html'
//   })
// }

if (isDev) {
  globalThis.$t = (key: string) => {
    return key
  }
}
else {
  // const modules = import.meta.glob('../../../web/src/locales/langs/*.json', { eager: true })

  // const langs = Object.keys(modules).reduce((acc, key) => {
  //   const lang = key.replace('../../../web/src/locales/langs/', '').replace('.json', '')
  //   acc[lang] = modules[key]
  //   return acc
  // }, {})

  // globalThis.$t = (key: string) => {
  //   return langs[key] || key
  // }
}
