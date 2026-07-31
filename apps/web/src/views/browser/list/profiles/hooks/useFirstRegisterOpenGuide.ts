import type { Driver } from 'driver.js'
import type { Ref } from 'vue'
import { blurDomSpotlight, focusDomSpotlight } from '/@/hooks/useDomSpotlight'
import { genDriver } from '/@/utils'
import { emitter } from '/@/utils/eventBus'

type ProfilesTableRef = Ref<{ refresh: (params?: Record<string, unknown>, force?: boolean) => Promise<void> } | null | undefined>

export function useFirstRegisterOpenGuide(options: {
  tableRef: ProfilesTableRef
  enabled: () => boolean
  onComplete?: () => void
}) {
  const driverObj = ref<Driver>()

  function driverNext() {
    if (driverObj.value) {
      driverObj.value = undefined
      emitter.emit('asideMenuGuide')
    }
  }

  async function onFirstRegisterGuide() {
    await options.tableRef.value?.refresh({}, true)
    nextTick(() => {
      driverObj.value = genDriver({
        showProgress: false,
        disableActiveInteraction: false,
        allowClose: true,
        overlayClickBehavior: 'close',
        showButtons: ['close'],
        stagePadding: 0,
        popoverOffset: 20,
        onDestroyed: () => {
          blurDomSpotlight()
          options.onComplete?.()
        },
        steps: [
          {
            element: '#OPEN_0',
            popover: {
              description: $t('点击「打开」以启动浏览器。'),
              side: 'right',
              align: 'center',
            },
            onHighlightStarted: () => {
              nextTick(() => {
                requestAnimationFrame(() => {
                  focusDomSpotlight('#OPEN_0')
                })
              })
            },
            onDeselected: () => {
              blurDomSpotlight()
            },
          },
        ],
      })

      driverObj.value.drive()
    })
  }

  onBeforeMount(() => {
    if (options.enabled())
      emitter.on('firstRegisterGuide', onFirstRegisterGuide)
  })

  onBeforeUnmount(() => {
    emitter.off('firstRegisterGuide', onFirstRegisterGuide)
  })

  return {
    driverObj,
    driverNext,
  }
}
