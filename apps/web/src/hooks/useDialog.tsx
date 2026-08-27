import { createVNode, render } from 'vue'
import type { AppContext, FunctionalComponent } from 'vue'
import Dialog from 'primevue/dialog'
import type { DialogProps, DialogSlots } from 'primevue/dialog'
import type { ButtonProps } from 'primevue/button'
import RxButton from '/@/components/rx-button/'
import type { SvgNames } from '/@/components/rx-icon/'
import { isFunction } from 'es-toolkit'
import type { JSX } from 'vue/jsx-runtime'
import { emitter } from '/@/utils/eventBus'

interface UseDialogOkProps extends Partial<Omit<ButtonProps, 'icon' | 'size' | 'disabled'>> {
  icon?: SvgNames
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  disabled?: boolean
}

interface UseDialogCustomProps {
  handleCancel?: (...args: any[]) => any
  handleOk?: (...args: any[]) => any
  beforeClose?: () => boolean | void | Promise<boolean | void>
  okText?: string
  okProps?: UseDialogOkProps
  cancelText?: string
  slots?: { [key in keyof DialogSlots]?: (instance: UseDialogInstance) => JSX.Element }
  noAutoClose?: boolean
  class?: string
}

export type UseDialogProps = DialogProps & UseDialogCustomProps

type UseDialogInnerProps = DialogProps & UseDialogCustomProps

export interface UseDialogInstance {
  hideModal: () => Promise<boolean>
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

    const innerProps = ref<UseDialogInnerProps>({
      draggable: false,
      ...props,
    })

    function doHide() {
      visible.value = false
      if (props.header) {
        dialogMap.delete(props.header)
      }

      emitter.off('kickedOut', handleKickedOut)
    }

    let closing = false
    async function tryClose(onClosed?: () => void): Promise<boolean> {
      if (closing) {
        return false
      }
      closing = true
      try {
        const result = await innerProps.value.beforeClose?.()
        if (result === false) {
          return false
        }
        doHide()
        onClosed?.()
        return true
      }
      finally {
        closing = false
      }
    }

    async function onVisibleUpdate(val: boolean) {
      if (val) {
        visible.value = true
        return
      }
      await tryClose(() => props?.handleCancel?.())
    }

    Object.assign(innerProps.value, {
      handleCancel: async () => {
        await tryClose(() => props?.handleCancel?.())
      },
      handleOk: async () => {
        await props?.handleOk?.()
        doHide()
      },
    })

    function onAfterHide() {
      div.remove()
    }

    function handleKickedOut() {
      console.log('User kicked out, closing dialog')
      setTimeout(tryClose, 500)
    }
    // if (!props.noAutoClose) {
    //   emitter.on('kickedOut', handleKickedOut)
    // }

    const instance = {
      dialogRef: ref<InstanceType<typeof Dialog> | null>(null),
      hideModal: () => tryClose(),
      handleOk: () => innerProps.value.handleOk?.(),
      handleCancel: () => innerProps.value.handleCancel?.(),
    }

    if (props.header) {
      dialogMap.set(props.header, instance)
    }

    const DialogComponent: FunctionalComponent = () => {
      const { handleCancel, handleOk, okText, cancelText, slots, okProps, beforeClose: _beforeClose, noAutoClose: _noAutoClose, ...dialogProps } = innerProps.value

      const __dialogSlots = {
        footer: () => (
          <div class="flex justify-end gap-2">
            {cancelText === '' ? null : <RxButton type="button" label={cancelText || $t('取消')} outlined severity="secondary" onClick={handleCancel}></RxButton>}
            <RxButton type="button" label={okText || $t('保存')} {...okProps} onClick={handleOk} />
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

      const dialogBindProps = {
        ...dialogProps,
        'visible': visible.value,
        'modal': true,
        'onUpdate:visible': onVisibleUpdate,
        'onAfter-hide': onAfterHide,
      }

      return (
        <Dialog
          ref={instance.dialogRef}
          v-slots={__dialogSlots}
          {...dialogBindProps as DialogProps}
        >
        </Dialog>
      )
    }

    const vnode = createVNode(DialogComponent)
    vnode.appContext = appContext
    render(vnode, div)
    visible.value = true
    return instance
  }

  return [showModal] as const
}
