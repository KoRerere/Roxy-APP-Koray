import type { AppContext, DefineComponent, FunctionalComponent, HTMLAttributes, VNode } from 'vue'
import Dialog, { type DialogProps, type DialogSlots } from 'primevue/dialog'
import { createVNode, render } from 'vue'
import RxButton from '/@/components/rx-button/'
import { $t } from '/@/locales'
import { isEqualWith } from 'es-toolkit'
import type { JSX } from 'vue/jsx-runtime'

export interface UseDialogProps extends DialogProps, Partial<Omit<HTMLAttributes, keyof DialogProps>> {
  /** 嵌套弹窗时，需要设置为 true */
  innerDialog?: boolean
  handleCancel?: () => any
  handleOk?: () => any
  okText?: string
  cancelText?: string
  slots?: {[key in keyof DialogSlots]?: (...args: any[]) => JSX.Element}
}

// 弹窗队列，避免一次性显示多个弹窗
const dialogQueue:UseDialogProps[] =  []
let appContext: AppContext | null = null
let lastProps: UseDialogProps | null = null

const customizer = (a: any, b: any) => {
  if (typeof a === 'function' && typeof b === 'function') {
    return a.toString() === b.toString();
  }
};

export function useDialog(comp?: VNode | DefineComponent) {
  let _modalInstance: any
  appContext ||= getCurrentInstance()!.appContext
  let innerDialog = false
  const innerProps = ref<UseDialogProps>({})

  const visible = ref(false)

  const DialogComponent: FunctionalComponent<UseDialogProps> = () => {
    const { handleCancel, handleOk, okText, cancelText, slots, ...dialogProps } = innerProps.value

    const __dialogSlots = {
      footer: () => (
        <div class="flex justify-end gap-2">
          {cancelText === '' ? null : <RxButton type="button" label={$t('取消')} outlined severity="secondary" onClick={handleCancel}></RxButton>}
          <RxButton type="button" label={okText || $t('保存')} onClick={handleOk}></RxButton>
        </div>
      ),
      default: slots?.default || comp,
      ...slots,
    }

    return (
      <Dialog v-slots={__dialogSlots} onAfterHide={onAfterHide} onHide={handleCancel} modal {...dialogProps} v-model:visible={visible.value}>
      </Dialog>
    )
  }

  const renderDialog = async () => {
    if (_modalInstance) {
      return _modalInstance
    }
    const div = document.createElement('div')
    const vnode = createVNode(DialogComponent )
    vnode.appContext = appContext
    render(vnode, div)
    _modalInstance = vnode.component!
    await nextTick()
    return _modalInstance
  }

  const rewriteProps = (props?: UseDialogProps) => {
    return {
      ...props,
      handleCancel: () => {
        hideModal()
        props?.handleCancel?.()
      },
      handleOk: async () => {
        await props?.handleOk?.()
        hideModal()
      },
    }
  }


  async function showModal(props: UseDialogProps) {
    if (!props.innerDialog && lastProps) {
      if (isEqualWith(lastProps, props, customizer) || dialogQueue.some(item => isEqualWith(item, props, customizer))) {
        return
      }
      dialogQueue.push(props)
    } else {
      innerDialog = Boolean(props.innerDialog)
      lastProps = props
      innerProps.value = rewriteProps(props)
      await renderDialog()
      visible.value = true
    }
  }

  function hideModal() {
    visible.value = false
  }

  function onAfterHide() {
    lastProps = null
    if (dialogQueue.length > 0) {
      showModal(dialogQueue.shift()!)
    }
  }

  const instance = {
    showModal,
    hideModal,
    handleOk: () => innerProps.value.handleOk?.(),
    handleCancel: () => innerProps.value.handleCancel?.(),
  }

  return [instance]
}
