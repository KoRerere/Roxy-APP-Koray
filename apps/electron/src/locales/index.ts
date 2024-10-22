// const modules = import.meta.glob('../../../web/src/locales/langs/*.json', { eager: true })

// const langs = Object.keys(modules).reduce((acc, key) => {
//   const lang = key.replace('../../../web/src/locales/langs/', '').replace('.json', '')
//   acc[lang] = modules[key]
//   return acc
// }, {})

globalThis.$t = (key: string) => {
  // return langs[key] || key
  return key
}
