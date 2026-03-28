import type { Directive, DirectiveBinding, ShallowRef } from 'vue'
import { usePermissionStore } from '/@/stores/permission.ts'
import type { Permission, PermissionMode } from '/@/hooks/usePermission/type'

type PermissionTarget = Permission | Permission[] | undefined

interface PermissionBindingState {
  target: PermissionTarget
  mode: PermissionMode
}

interface PermissionEl extends HTMLElement {
  _vPermissionAnchor?: Comment
  _vPermissionParent?: ParentNode
  _vPermissionState?: ShallowRef<PermissionBindingState>
  _vPermissionStop?: () => void
}

function resolveMode(binding: DirectiveBinding<Permission | Permission[]>): PermissionMode {
  return binding.modifiers.all ? 'all' : 'any'
}

function syncPermissionElement(el: PermissionEl, hasPermission: boolean) {
  const anchor = el._vPermissionAnchor
  const parent = el._vPermissionParent

  if (!anchor || !parent)
    return

  const isInDom = el.parentNode !== null

  if (hasPermission && !isInDom) {
    parent.insertBefore(el, anchor)
    anchor.remove()
  }
  else if (!hasPermission && isInDom) {
    parent.insertBefore(anchor, el)
    el.remove()
  }
}

export const vPermission: Directive<PermissionEl, Permission | Permission[]> = {
  mounted(el, binding) {
    if (!el.parentNode)
      return

    el._vPermissionAnchor = document.createComment('permission out')
    el._vPermissionParent = el.parentNode
    el._vPermissionState = shallowRef({
      target: binding.value,
      mode: resolveMode(binding),
    })

    const store = usePermissionStore()

    el._vPermissionStop = watchEffect(() => {
      const state = el._vPermissionState?.value
      syncPermissionElement(el, state ? store.check(state.target, state.mode) : false)
    })
  },
  updated(el, binding) {
    if (el._vPermissionState) {
      el._vPermissionState.value = {
        target: binding.value,
        mode: resolveMode(binding),
      }
    }
  },
  unmounted(el) {
    el._vPermissionStop?.()
  },
}
