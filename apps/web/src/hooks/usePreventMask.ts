const MASK_ID = '__prevent-mask-overlay__'
const maskElement = document.createElement('div')
maskElement.id = MASK_ID
Object.assign(maskElement.style, {
  display: 'none',
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0)', // 完全透明
  zIndex: '10', // 确保在最上层
  pointerEvents: 'auto', // 确保可以阻止下层交互
})
document.body.appendChild(maskElement)

/** 创建一个透明的蒙层，用于阻止用户与下层元素交互 */
export function usePreventMask() {
  onBeforeUnmount(() => {
    hideMask()
  })

  /** 显示蒙层 */
  function showMask() {
    maskElement.style.display = 'block'
  }

  function hideMask() {
    maskElement.style.display = 'none'
  }

  return {
    showPreventMask: showMask,
    hidePreventMask: hideMask,
  }
}
