import type { AppContext, DefineComponent, FunctionalComponent, HTMLAttributes, VNode } from 'vue'
import Dialog, { type DialogProps, type DialogSlots } from 'primevue/dialog'
import { createVNode, render } from 'vue'
import RxButton from '/@/components/rx-button/'
import { $t } from '/@/locales'
import { isEqualWith, isFunction } from 'es-toolkit'
import type { JSX } from 'vue/jsx-runtime'

export interface UseDialogProps extends DialogProps, Partial<Omit<HTMLAttributes, keyof DialogProps>> {
  /** 嵌套弹窗时，需要设置为 true */
  innerDialog?: boolean
  handleCancel?: () => any
  handleOk?: () => any
  okText?: string
  cancelText?: string
  slots?: {[key in keyof DialogSlots]?: (instance: UseDialogInstance) => JSX.Element}
}

export interface UseDialogInstance {
  hideModal: () => void
  handleOk: () => void
  handleCancel: () => void
}

// 弹窗队列，避免一次性显示多个弹窗
const dialogQueue:UseDialogProps[] =  []
// 根据 header 来判断是否是同一个弹窗
const dialogMap = new Map<string, UseDialogInstance>()
let appContext: AppContext | null = null

const customizer = (a: any, b: any) => {
  if (typeof a === 'function' && typeof b === 'function') {
    return a.toString() === b.toString();
  }
};

export function useDialog( ) {
  appContext ||= getCurrentInstance()!.appContext

    function showModal(props: UseDialogProps) {
      const dialog = dialogMap.get(props.header || '')
      if (dialog) {
        return dialog
      }

      const div = document.createElement('div')

      function hideModal() {
        visible.value = false
        if (props.header) {
          dialogMap.delete(props.header)
        }
      }

      function onAfterHide() {
        div.remove()
      }

      const innerProps = ref<UseDialogProps>({
        ...props,
        handleCancel: () => {
          hideModal()
          props?.handleCancel?.()
        },
        handleOk: async () => {
          await props?.handleOk?.()
          hideModal()
        },
      })

      const visible = ref(false)
      const instance = {
        hideModal,
        handleOk: () => innerProps.value.handleOk?.(),
        handleCancel: () => innerProps.value.handleCancel?.(),
      }

      if (props.header) {
        dialogMap.set(props.header, instance)
      }

      const DialogComponent: FunctionalComponent<UseDialogProps> = () => {
        const { handleCancel, handleOk, okText, cancelText, slots, ...dialogProps } = innerProps.value

        const __dialogSlots = {
          footer: () => (
            <div class="flex justify-end gap-2">
              {cancelText === '' ? null : <RxButton type="button" label={$t('取消')} outlined severity="secondary" onClick={handleCancel}></RxButton>}
              <RxButton type="button" label={okText || $t('保存')} onClick={handleOk}></RxButton>
            </div>
          ),
          ...Object.entries(slots || {}).reduce((acc, [key, value]) => {
            acc[key] = isFunction(value) ? new Proxy(value, {
              apply: (target, thisArg, argArray) => {
                return Reflect.apply(target, thisArg, [instance, ...argArray])
              }
            }) : value
            return acc
          }, {} as Record<string, (instance: UseDialogInstance) => JSX.Element>)
        }

        return (
          <Dialog v-slots={__dialogSlots} onAfterHide={onAfterHide} onHide={handleCancel} modal {...dialogProps} v-model:visible={visible.value}>
          </Dialog>
        )
      }

    const vnode = createVNode(DialogComponent )
    vnode.appContext = appContext
    render(vnode, div)
    visible.value = true

      return instance
  }

  return [showModal]
}
