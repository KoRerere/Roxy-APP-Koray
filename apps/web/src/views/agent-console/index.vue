<script setup lang="ts">
import './styles/color-tokens.css'
import './styles/effect-tokens.css'
import { defineAsyncComponent } from 'vue'
import { useThemeStore } from '/@/stores/theme'
import { getImage } from '/@/utils/basic'
import { supportsApp4_0_2 } from '/@/utils/app-supports'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'
import { useI18n } from 'vue-i18n'
import AgentConsoleShellFallback from './components/skeleton/AgentConsoleShellSkeleton.vue'
import BrandHeader from './components/BrandHeader.vue'
import AgentConsoleShell from './components/AgentConsoleShell.vue'

perfLog('agent-page:setup:start')

// const AgentConsoleShell = defineAsyncComponent({
//   loader: () => {
//     const endLoad = createPerfTimer('agent-shell:async-load')
//     return import('./components/AgentConsoleShell.vue')
//       .then((component) => {
//         endLoad()
//         return component
//       })
//       .catch((error) => {
//         endLoad({ error: error instanceof Error ? error.message : String(error) })
//         throw error
//       })
//   },
//   loadingComponent: AgentConsoleShellFallback,
//   delay: 0,
// })

const AGENT_CONSOLE_MIN_APP_VERSION = '4.0.2'
const appVersionResolved = ref(!globalThis.isElectron || !!globalThis.$appVersion)
const themeStore = useThemeStore()
const { locale } = useI18n()

const agentConsoleSupported = computed(() => {
  return !globalThis.isElectron || (appVersionResolved.value && supportsApp4_0_2())
})

const isZhLocale = computed(() => locale.value.toLowerCase().startsWith('zh'))
const isDarkTheme = computed(() => themeStore.realTheme === 'dark')

const versionGuardMeshSrc = computed(() => getImage(
  `agent/version-guard/mesh-${isDarkTheme.value ? 'dark' : 'light'}.svg`,
))

const versionGuardShowcaseSrc = computed(() => {
  const language = isZhLocale.value ? 'zh' : 'en'
  const theme = isDarkTheme.value ? 'dark' : 'light'
  return getImage(`agent/version-guard/showcase-${language}-${theme}.svg`)
})

const versionGuardTitle = computed(() => isZhLocale.value ? '焕新升级' : 'AI Agent New Upgrade')
const versionGuardSubtitle = computed(() => isZhLocale.value
  ? '更新 Roxy 浏览器至最新版本体验'
  : 'Update Roxy Browser to the latest version')

onMounted(() => {
  document.body.classList.add('agent-console-window')
  perfLog('agent-page:mounted')
})

onUnmounted(() => {
  document.body.classList.remove('agent-console-window')
})

async function resolveAppVersion() {
  if (!globalThis.isElectron)
    return

  try {
    const endResolveAppVersion = createPerfTimer('agent-page:resolveAppVersion')
    const version = globalThis.$appVersion || await globalThis.electronAPI.send('app:getAppVersion')
    globalThis.$appVersion = version
    endResolveAppVersion({ version })
  }
  catch (error) {
    console.warn('[agent-console] Failed to resolve app version:', error)
  }
  finally {
    appVersionResolved.value = true
    perfLog('agent-page:appVersionResolved', { supported: supportsApp4_0_2() })
  }
}

void resolveAppVersion()
</script>

<template>
  <AgentConsoleShell v-if="agentConsoleSupported" />

  <main
    v-else-if="appVersionResolved"
    class="agent-console-version-guard"
    :class="{ 'agent-console-version-guard--dark': isDarkTheme }"
  >
    <img
      class="agent-console-version-guard__mesh"
      :src="versionGuardMeshSrc"
      alt=""
      aria-hidden="true"
    >

    <BrandHeader class="agent-console-version-guard__brand" />

    <section class="agent-console-version-guard__hero">
      <h1>
        <template v-if="isZhLocale">
          <span class="agent-console-version-guard__title-latin">AI Agent&nbsp;</span>
          <span>{{ versionGuardTitle }}</span>
        </template>
        <template v-else>
          {{ versionGuardTitle }}
        </template>
      </h1>
      <p>{{ versionGuardSubtitle }}</p>
      <span class="agent-console-version-guard__sr-only">
        {{ $t('当前版本不支持 AI Agent，请更新到 v{version} 或更高版本。', { version: AGENT_CONSOLE_MIN_APP_VERSION }) }}
      </span>
    </section>

    <img
      class="agent-console-version-guard__showcase"
      :src="versionGuardShowcaseSrc"
      alt=""
      aria-hidden="true"
    >
  </main>
</template>

<style lang="scss" scoped>
.agent-console-version-guard {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100svh;
  box-sizing: border-box;
  color: var(--color-text-primary, #141414);
  background: var(--color-bg-primary, #fcfcfc);
  overflow: hidden;
  isolation: isolate;

  &--dark {
    color: #fcfcfc;
    background: #0f0f0f;
  }
}

.agent-console-version-guard__mesh {
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}

.agent-console-version-guard__brand {
  position: absolute;
  z-index: 2;
  top: 24px;
  left: 24px;
}

.agent-console-version-guard__hero {
  position: absolute;
  z-index: 2;
  top: 99px;
  left: 50%;
  display: flex;
  width: calc(100% - 48px);
  flex-direction: column;
  align-items: center;
  gap: 16px;
  transform: translateX(-50%);
  text-align: center;
  word-break: break-word;

  h1 {
    margin: 0;
    color: inherit;
    font-family: Archivo, Inter, 'PingFang SC', sans-serif;
    font-size: clamp(32px, 5.167vw, 62px);
    font-weight: 600;
    line-height: normal;
    white-space: nowrap;
  }

  p {
    width: 100%;
    margin: 0;
    color: var(--color-text-tertiary, #525252);
    font-family: 'PingFang SC', Inter, sans-serif;
    font-size: 20px;
    font-weight: 400;
    line-height: 28px;
  }
}

.agent-console-version-guard--dark .agent-console-version-guard__hero p {
  color: #a3a3a3;
}

.agent-console-version-guard__title-latin {
  font-size: clamp(33px, 5.333vw, 64px);
}

.agent-console-version-guard__showcase {
  position: absolute;
  z-index: 1;
  bottom: 0;
  left: 50%;
  display: block;
  width: min(952px, calc(100vw - 48px));
  height: auto;
  max-height: calc(100svh - 270px);
  transform: translateX(-50%);
  object-fit: contain;
  object-position: center bottom;
  pointer-events: none;
  user-select: none;
}

.agent-console-version-guard__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  border: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-height: 700px) {
  .agent-console-version-guard__hero {
    top: 72px;
    gap: 10px;

    h1 {
      font-size: clamp(30px, 4.5vw, 48px);
    }

    p {
      font-size: 16px;
      line-height: 24px;
    }
  }

  .agent-console-version-guard__title-latin {
    font-size: clamp(31px, 4.667vw, 50px);
  }

  .agent-console-version-guard__showcase {
    max-height: calc(100svh - 210px);
  }
}

@media (max-width: 640px) {
  .agent-console-version-guard__brand {
    top: 16px;
    left: 16px;
  }

  .agent-console-version-guard__hero {
    top: 88px;

    h1 {
      font-size: clamp(27px, 8vw, 42px);
    }

    p {
      font-size: 16px;
      line-height: 24px;
    }
  }

  .agent-console-version-guard__title-latin {
    font-size: clamp(28px, 8.3vw, 44px);
  }

  .agent-console-version-guard__showcase {
    width: calc(100vw - 24px);
  }
}
</style>
