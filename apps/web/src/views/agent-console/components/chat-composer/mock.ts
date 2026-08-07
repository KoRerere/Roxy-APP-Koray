import type { AgentComposerItem, AgentComposerTokenKind } from './types'

const mockProfiles: AgentComposerItem[] = [
  {
    id: 'profile-mou-72',
    kind: 'profile',
    title: 'MOU-72 · dance_daily',
    label: 'MOU-72 · dance_daily',
    description: 'tiktok.com/@dance_daily',
    iconName: 'country-code/US',
    group: 'Windows',
    payload: { dirId: 'profile-mou-72' },
  },
  {
    id: 'profile-mou-89',
    kind: 'profile',
    title: 'MOU-89 · store_admin',
    label: 'MOU-89 · store_admin',
    description: 'facebook.com/store_admin',
    iconName: 'country-code/US',
    group: 'Windows',
    payload: { dirId: 'profile-mou-89' },
  },
  {
    id: 'profile-mou-90',
    kind: 'profile',
    title: 'MOU-90 · page_ops',
    label: 'MOU-90 · page_ops',
    description: 'instagram.com/page_ops',
    iconName: 'country-code/US',
    group: 'Windows',
    payload: { dirId: 'profile-mou-90' },
  },
  {
    id: 'profile-mou-91',
    kind: 'profile',
    title: 'MOU-91 · shop_ops',
    label: 'MOU-91 · shop_ops',
    description: 'tiktok.com/@shop_ops',
    iconName: 'country-code/US',
    group: 'Windows',
    payload: { dirId: 'profile-mou-91' },
  },
]

const mockSkills: AgentComposerItem[] = [
  {
    id: 'official:101',
    kind: 'skill',
    title: 'Batch account nurturing',
    description: 'Multi-account concurrent simulation of real person behavior ensures safe account nurturing',
    iconName: 'roxy-agent/rx-ic-templates',
    group: 'Skills',
    payload: { templateRef: 'official:101' },
  },
  {
    id: 'user:102',
    kind: 'skill',
    title: 'Login state checker',
    description: 'Open windows and verify platform login state before running campaigns',
    iconName: 'roxy-agent/rx-ic-templates',
    group: 'Skills',
    payload: { templateRef: 'user:102' },
  },
  {
    id: 'official:103',
    kind: 'skill',
    title: 'Publish content flow',
    description: 'Prepare assets, open selected profiles, and publish scheduled content',
    iconName: 'roxy-agent/rx-ic-templates',
    group: 'Skills',
    payload: { templateRef: 'official:103' },
  },
]

const mockScripts: AgentComposerItem[] = [
  {
    id: 'user:201',
    kind: 'script',
    title: 'Profile warmup script',
    description: 'Run a local browser warmup script before account operations',
    iconName: 'base/rx_ic_doc_code',
    group: 'Scripts',
    payload: { templateRef: 'user:201' },
  },
  {
    id: 'official:202',
    kind: 'script',
    title: 'Cookie health check',
    description: 'Inspect cookie freshness and mark profiles that need manual login',
    iconName: 'base/rx_ic_doc_code',
    group: 'Scripts',
    payload: { templateRef: 'official:202' },
  },
]

function waitForMockData<T>(data: T) {
  return new Promise<T>((resolve) => {
    window.setTimeout(resolve, 120, data)
  })
}

export async function fetchAgentComposerProfiles() {
  return waitForMockData(mockProfiles.map(item => ({ ...item, payload: { ...item.payload } })))
}

export async function fetchAgentComposerSkills() {
  return waitForMockData(mockSkills.map(item => ({ ...item, payload: { ...item.payload } })))
}

export async function fetchAgentComposerScripts() {
  return waitForMockData(mockScripts.map(item => ({ ...item, payload: { ...item.payload } })))
}

export async function fetchAgentComposerItems(kind: AgentComposerTokenKind | 'slash') {
  if (kind === 'profile')
    return fetchAgentComposerProfiles()

  const [skills, scripts] = await Promise.all([
    fetchAgentComposerSkills(),
    fetchAgentComposerScripts(),
  ])

  if (kind === 'skill')
    return skills

  if (kind === 'script')
    return scripts

  return [...skills, ...scripts]
}
