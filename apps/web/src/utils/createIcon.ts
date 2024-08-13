import * as icons from '@ant-design/icons-vue'

import { createVNode } from 'vue'

export function CreateIcon(props: { name: any }) {
  const { name } = props
  const antIcon: { [key: string]: any } = icons
  return createVNode(antIcon[name])
}

export default CreateIcon
