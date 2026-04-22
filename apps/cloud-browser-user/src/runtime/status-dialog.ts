import { reactive, readonly } from 'vue'

export type StatusDialogVariant = 'promo' | 'notice'

export interface StatusDialogOptions {
  title: string
  description?: string
  features?: string[]
  primaryText: string
  variant?: StatusDialogVariant
  onPrimary?: () => void | Promise<void>
}

interface StatusDialogState {
  current: StatusDialogOptions | null
  pending: boolean
}

const state = reactive<StatusDialogState>({
  current: null,
  pending: false,
})

let currentResolver: (() => void) | null = null

function resolveCurrent() {
  const resolver = currentResolver
  currentResolver = null
  resolver?.()
}

export const statusDialogState = readonly(state)

export function openStatusDialog(options: StatusDialogOptions): Promise<void> {
  state.current = {
    variant: 'promo',
    ...options,
  }
  state.pending = false
  resolveCurrent()

  return new Promise((resolve) => {
    currentResolver = resolve
  })
}

function closeStatusDialog() {
  state.current = null
  state.pending = false
  resolveCurrent()
}

export async function confirmStatusDialog() {
  if (!state.current || state.pending) {
    return
  }

  state.pending = true

  try {
    await state.current.onPrimary?.()
  }
  finally {
    closeStatusDialog()
  }
}
