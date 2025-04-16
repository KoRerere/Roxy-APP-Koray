import type { MenuItem } from 'primevue/menuitem'

export interface MenuProps {
  mode?: {
    type: 'single' | 'multiple',
    value?: any,
    options: MenuItem[]
    field?: string
    props?: Record<string, any>
  }
  model?: MenuItem[]
  slots?: Record<string, any>
  menuProps?: Record<string, any>
}