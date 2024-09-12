export const svgIcons = import.meta.glob<Component>('../../../assets/images/**/*.svg', {
  query: '?component',
})
