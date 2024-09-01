import { useDialog } from 'primevue/usedialog'
import simplePopup from './inputs-popup.vue'

const dialog = useDialog()

export default function showPopup(data: any) {
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: data.props,
    emits: data.emits,
  })
}
