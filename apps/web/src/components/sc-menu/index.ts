import { createVNode, render } from 'vue'
import menu from './sc-menu.vue'

function insertComponent(props: { message: string }) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const vnode = createVNode(menu, props)

  render(vnode, container)

  return () => {
    render(null, container)
    document.body.removeChild(container)
  }
}

export default insertComponent

// 使用示例
// const destroyComponent = insertComponent({ message: 'This is a dynamic component!' })

// 销毁组件
// destroyComponent();
