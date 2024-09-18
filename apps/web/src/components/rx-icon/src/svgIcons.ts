// 在该模块中拒绝 HMR 更新
if (import.meta.hot) {
  // 拒绝该模块的热更新
  import.meta.hot.accept((module) => {
    // 你可以使用新的模块实例来决定是否使其失效。
    import.meta.hot.invalidate()
  })
  import.meta.hot.invalidate()
}

export const svgIcons = import.meta.glob<Component>('../../../assets/images/**/*.svg', {
  query: '?component',
  eager: true,
})
