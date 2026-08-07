import { useDialog } from 'primevue/usedialog'
import CustomTemplateDialog from '../components/dialog/CustomTemplateDialog.vue'

export function useCustomTemplateDialog() {
  const dialog = useDialog()

  function openCustomTemplateDialog() {
    dialog.open(CustomTemplateDialog, {
      props: {
        modal: true,
        blockScroll: true,
        dismissableMask: false,
        draggable: false,
        showHeader: false,
        style: { width: 'min(640px, calc(100vw - 32px))' },
        pt: {
          root: 'agent-console-dialog agent-console-custom-template-dialog',
          content: '!p-0 !overflow-hidden',
        },
      },
    })
  }

  return { openCustomTemplateDialog }
}
