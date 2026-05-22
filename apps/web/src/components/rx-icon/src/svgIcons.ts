const modules = import.meta.glob<Component>('../../../assets/icons/**/*.svg', {
  query: '?component',
  eager: false,
})

export const svgIcons = Object.entries(modules).reduce((acc, [key, value]) => {
  if (import.meta.hot) {
    requestIdleCallback(value)
  }
  acc[key] = defineAsyncComponent(value)
  return acc
}, {} as Record<string, Component>)
