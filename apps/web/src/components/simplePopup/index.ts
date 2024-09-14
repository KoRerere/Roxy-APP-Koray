import { useDialog } from 'primevue/usedialog'

import popup from './index.vue'

export function useSimplePopup() {
  const dialog = useDialog()

  function show(data: any) {
    dialog.open(popup, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
      },
      data,
    })
  }

  return [show]
}

export default popup
