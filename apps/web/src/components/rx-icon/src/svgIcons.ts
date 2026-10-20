const modules = import.meta.glob<Component>('../../../assets/icons/**/*.svg', {
  query: '?component',
  eager: false,
})

export const svgIcons = Object.entries(modules).reduce((acc, [key, value]) => {
  // 仅加载实际使用的图标，避免开发态刷新时同时预取全部图标导致连接重置。
  acc[key] = defineAsyncComponent(value)
  return acc
}, {} as Record<string, Component>)
