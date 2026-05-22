import { createVNode, render } from 'vue'
import type { AppContext, FunctionalComponent, HTMLAttributes } from 'vue'
import Dialog from 'primevue/dialog'
import type { DialogProps, DialogSlots } from 'primevue/dialog'
import RxButton from '/@/components/rx-button/'
import { isFunction } from 'es-toolkit'
import type { JSX } from 'vue/jsx-runtime'
import type { ButtonProps } from 'primevue/button'
import { emitter } from '/@/utils/eventBus'

export interface UseDialogProps extends DialogProps, Partial<Omit<HTMLAttributes, keyof DialogProps>> {
  handleCancel?: (...args: any[]) => any
  handleOk?: (...args: any[]) => any
  beforeClose?: (closeCallback: () => any) => any
  okText?: string
  okProps?: ButtonProps
  cancelText?: string
  slots?: { [key in keyof DialogSlots]?: (instance: UseDialogInstance) => JSX.Element }
  noAutoClose?: boolean
}

export interface UseDialogInstance {
  hideModal: () => void
  handleOk: () => void
  handleCancel: () => void
}

// 弹窗队列，避免一次性显示多个弹窗
// const dialogQueue: UseDialogProps[] = []
// 根据 header 来判断是否是同一个弹窗
const dialogMap = new Map<string, UseDialogInstance>()
let appContext: AppContext | null = null

// function customizer(a: any, b: any) {
//   if (typeof a === 'function' && typeof b === 'function') {
//     return a.toString() === b.toString()
//   }
// }

export function useDialog() {
  appContext ||= getCurrentInstance()!.appContext

  function showModal(props: UseDialogProps) {
    const dialog = dialogMap.get(props.header || '')
    if (dialog) {
      return dialog
    }

    const div = document.createElement('div')
    const visible = ref(false)

    function hideModal() {
      visible.value = false
      if (props.header) {
        dialogMap.delete(props.header)
      }

      emitter.off('kickedOut', handleKickedOut)
    }

    function onAfterHide() {
      div.remove()
    }

    const innerProps = ref<UseDialogProps>({
      draggable: false,
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

    function handleKickedOut() {
      console.log('退出登录了，关闭弹窗')
      setTimeout(hideModal, 500)
    }
    // if (!props.noAutoClose) {
    //   emitter.on('kickedOut', handleKickedOut)
    // }

    const instance = {
      dialogRef: ref<InstanceType<typeof Dialog> | null>(null),
      hideModal,
      handleOk: () => innerProps.value.handleOk?.(),
      handleCancel: () => innerProps.value.handleCancel?.(),
    }

    if (props.header) {
      dialogMap.set(props.header, instance)
    }

    const DialogComponent: FunctionalComponent<UseDialogProps> = () => {
      const { handleCancel, handleOk, okText, cancelText, slots, okProps, ...dialogProps } = innerProps.value

      const __dialogSlots = {
        footer: () => (
          <div class="flex justify-end gap-2">
            {cancelText === '' ? null : <RxButton type="button" label={cancelText || $t('取消')} outlined severity="secondary" onClick={handleCancel}></RxButton>}
            <RxButton type="button" label={okText || $t('保存')} {...okProps} onClick={handleOk}></RxButton>
          </div>
        ),
        ...Object.entries(slots || {}).reduce((acc, [key, value]) => {
          acc[key] = isFunction(value)
            ? new Proxy(value, {
                apply: (target, thisArg, argArray) => {
                  return Reflect.apply(target, thisArg, [instance, ...argArray])
                },
              })
            : value
          return acc
        }, {} as Record<string, (instance: UseDialogInstance) => JSX.Element>),
      }

      return (
        <Dialog ref={instance.dialogRef} v-slots={__dialogSlots} onAfterHide={onAfterHide} onHide={handleCancel} modal {...dialogProps} v-model:visible={visible.value}></Dialog>
      )
    }

    const vnode = createVNode(DialogComponent)
    vnode.appContext = appContext
    render(vnode, div)
    visible.value = true
    if (instance.dialogRef.value?.close) {
      const originalClose = instance.dialogRef.value.close
      instance.dialogRef.value.close = () => {
        if (props.beforeClose) {
          props.beforeClose(originalClose)
        }
        else {
          originalClose()
        }
      }
    }
    return instance
  }

  return [showModal] as const
}
