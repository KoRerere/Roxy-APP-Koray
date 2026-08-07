import { useLocalStorage } from '@vueuse/core'

export type AgentAccessMode = 'ask' | 'full'

const STORAGE_KEY = 'agent-console-access-mode'
const LEGACY_STORAGE_KEY = 'chatStream'
let accessModeState: ReturnType<typeof useLocalStorage<AgentAccessMode>> | undefined

function normalizeAccessMode(value: string | null | undefined): AgentAccessMode {
  return value === 'full' ? 'full' : 'ask'
}

function getInitialAccessMode(): AgentAccessMode {
  if (typeof localStorage === 'undefined')
    return 'full'

  const currentValue = localStorage.getItem(STORAGE_KEY)
  if (currentValue)
    return normalizeAccessMode(currentValue.replace(/^"|"$/g, ''))

  const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyValue)
    return 'full'

  try {
    const parsed = JSON.parse(legacyValue) as { fullAccess?: unknown }
    return parsed.fullAccess === true ? 'full' : 'ask'
  }
  catch {
    return 'full'
  }
}

export function useAgentAccessMode() {
  accessModeState ||= useLocalStorage<AgentAccessMode>(STORAGE_KEY, getInitialAccessMode(), {
    listenToStorageChanges: true,
  })

  const accessMode = computed({
    get: () => normalizeAccessMode(accessModeState!.value),
    set: (value: AgentAccessMode) => {
      accessModeState!.value = normalizeAccessMode(value)
    },
  })

  const fullAccess = computed({
    get: () => accessMode.value === 'full',
    set: (value: boolean) => {
      accessMode.value = value ? 'full' : 'ask'
    },
  })

  return {
    accessMode,
    fullAccess,
  }
}
