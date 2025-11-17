<script setup lang="ts">
import Netflix from './components/netflix.vue'
import ComeBackModal from './come-back-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useWorkspaceStore } from '/@/stores/workspace'

const sharedMap = {
  netflix: Netflix
}

const activeKey = ref<keyof typeof sharedMap>('netflix')

const ActiveComponent = computed(() => sharedMap[activeKey.value])
const [showModal] = useDialog()
const { setCurrentWorkspace } = useWorkspaceStore()

onBeforeMount(() => {
  if (!localStorage.getItem('__$wcis_nf')) {
    showWelcomeModal()
  }
})

function showWelcomeModal() {
  showModal({
    header: '__$wcis_nf',
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      root: "!border-none !shadow-none rounded-lg",
    },
    handleCancel: () => {
      localStorage.setItem('__$wcis_nf', '1')
      setCurrentWorkspace(-1)
    },
    slots: {
      container: ({ hideModal }) => h(ComeBackModal, {
        onClose: hideModal
      })
    }
  })
}
</script>

<template>
  <component :is="ActiveComponent" />
</template>

<style lang="scss" scoped></style>
