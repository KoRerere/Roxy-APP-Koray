import { createVNode, render } from 'vue'
import menu from './sc-menu.vue'

class ScMenu {
  container: any
  constructor() {}
  insert(props: any) {
    this.destroy()
    this.container = document.createElement('div')
    document.body.appendChild(this.container)
    const vnode = createVNode(menu, props)
    render(vnode, this.container)
  }

  destroy() {
    if (this.container) {
      render(null, this.container)
      document.body.removeChild(this.container)
      this.container = null
    }
  }
}

function createScMenu() {
  let scMenu: ScMenu | null = null
  return function () {
    if (scMenu)
      return scMenu
    scMenu = new ScMenu()
    return scMenu
  }
}

export default createScMenu()

// 使用示例
// const scMenu = new ScMenu()
// scMenu.insert({ message: 'This is a dynamic component!' }) // 插入组件
// scMenu.destroy() // 销毁组件
