import { computed, ref } from 'vue'
import { defaultColors } from '/@/utils/constants'

export interface CloudPhoneTag {
  name: string
  color: string
}

export interface CloudPhoneItem {
  id: string
  name: string
  no: number
  system: string
  unlimited?: boolean
  proxyLocation: string
  proxyIp: string
  group: string
  tags: string[]
  notes: string
  createdTime: string
  lastOpened: string
  operator: string
  status: 'running' | 'stopped'
  billing?: 'minute' | 'monthly'
  proxyInfo?: Record<string, unknown>
  device?: { location: string, timezone: string, brand: string, model: string, language: string, phoneNumber: string, imei: string, mac: string }
}

export interface CloudPhoneLog {
  id: string
  action: string
  phoneName: string
  operator: string
  time: string
  status: 'success' | 'failed'
}

const STORAGE_KEY = 'roxy_cloud_phones'
const TRASH_KEY = 'roxy_cloud_phones_trash'
const TAGS_KEY = 'roxy_cloud_phone_tags'

function getInitialPhones(): CloudPhoneItem[] {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    }
    catch {
      // ignore
    }
  }
  return [
    {
      id: '634950889139922530',
      name: 'One',
      no: 1,
      system: 'Android 15',
      unlimited: true,
      proxyLocation: 'HK/HongKong',
      proxyIp: '103.14.90.094',
      group: '未分组',
      tags: ['Social'],
      notes: 'Main device',
      createdTime: '2026-08-29 15:50:22',
      lastOpened: '2026-08-29 15:50:22',
      operator: '584767040@qq.com',
      status: 'running',
    },
    {
      id: '634950889139922531',
      name: 'Two',
      no: 2,
      system: 'Android 15',
      unlimited: true,
      proxyLocation: 'US/United States',
      proxyIp: '154.21.32.112',
      group: 'TikTok Matrix',
      tags: ['Marketing'],
      notes: 'Promo account',
      createdTime: '2026-08-30 11:20:10',
      lastOpened: '2026-08-30 14:15:33',
      operator: '584767040@qq.com',
      status: 'stopped',
    },
    {
      id: '634950889139922532',
      name: 'Three',
      no: 3,
      system: 'Android 14',
      unlimited: true,
      proxyLocation: 'SG/Singapore',
      proxyIp: '45.112.78.204',
      group: '未分组',
      tags: ['VIP'],
      notes: '',
      createdTime: '2026-08-31 09:10:05',
      lastOpened: '2026-08-31 09:40:12',
      operator: '584767040@qq.com',
      status: 'stopped',
    },
  ]
}

function getInitialTrash(): CloudPhoneItem[] {
  const saved = localStorage.getItem(TRASH_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    }
    catch {
      // ignore
    }
  }
  return []
}

// Global reactive state
const phones = ref<CloudPhoneItem[]>(getInitialPhones())
const trash = ref<CloudPhoneItem[]>(getInitialTrash())
const phoneTags = ref<CloudPhoneTag[]>(getInitialTags())

function getInitialTags(): CloudPhoneTag[] {
  let saved: CloudPhoneTag[] = []
  try {
    const value = JSON.parse(localStorage.getItem(TAGS_KEY) || '[]')
    if (Array.isArray(value)) {
      saved = value.filter(tag => typeof tag?.name === 'string' && tag.name.trim() && defaultColors.includes(tag.color))
    }
  }
  catch {
    // 旧数据没有颜色记录时，从现有标签初始化色点。
  }
  const names = new Set([...phones.value, ...trash.value].flatMap(phone => phone.tags))
  for (const name of names) {
    if (!saved.some(tag => tag.name === name)) {
      saved.push({ name, color: defaultColors[(saved.length + 4) % defaultColors.length]! })
    }
  }
  return saved
}
const logs = ref<CloudPhoneLog[]>([
  {
    id: 'log_1',
    action: 'Start Cloud Phone',
    phoneName: 'One',
    operator: '584767040@qq.com',
    time: '2026-08-29 15:50:22',
    status: 'success',
  },
  {
    id: 'log_2',
    action: 'Create Cloud Phone',
    phoneName: 'One',
    operator: '584767040@qq.com',
    time: '2026-08-29 15:48:10',
    status: 'success',
  },
])

function syncStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(phones.value))
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash.value))
}

export function useCloudPhones() {
  const searchQuery = ref('')
  const selectedGroup = ref<string>('all')

  const groups = computed(() => {
    const set = new Set<string>()
    phones.value.forEach(p => set.add(p.group))
    return ['all', ...Array.from(set)]
  })

  const filteredPhones = computed(() => {
    return phones.value.filter((item) => {
      if (selectedGroup.value !== 'all' && item.group !== selectedGroup.value) {
        return false
      }
      if (!searchQuery.value.trim()) {
        return true
      }
      const q = searchQuery.value.toLowerCase().trim()
      return (
        item.name.toLowerCase().includes(q)
        || item.id.includes(q)
        || item.proxyIp.includes(q)
        || item.notes.toLowerCase().includes(q)
        || item.tags.some(t => t.toLowerCase().includes(q))
      )
    })
  })

  function addPhone(payload: Partial<CloudPhoneItem>) {
    const id = crypto.randomUUID()
    const newPhone: CloudPhoneItem = {
      id,
      name: payload.name || `Phone-${phones.value.length + 1}`,
      no: Math.max(0, ...phones.value.map(phone => phone.no), ...trash.value.map(phone => phone.no)) + 1,
      system: payload.system || 'Android 15',
      unlimited: true,
      proxyLocation: payload.proxyLocation || 'HK/HongKong',
      proxyIp: payload.proxyIp || '103.14.90.094',
      group: payload.group || '未分组',
      tags: payload.tags || [],
      notes: payload.notes || '',
      createdTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      lastOpened: '-',
      operator: '584767040@qq.com',
      status: 'stopped',
      billing: payload.billing,
      proxyInfo: payload.proxyInfo,
      device: payload.device,
    }
    // 存储成功后再更新列表，避免失败重试时生成重复记录。
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newPhone, ...phones.value]))
    phones.value.unshift(newPhone)
    logs.value.unshift({
      id: `log_${id}`,
      action: 'Create Cloud Phone',
      phoneName: newPhone.name,
      operator: '584767040@qq.com',
      time: newPhone.createdTime,
      status: 'success',
    })
    return newPhone
  }

  function renamePhone(id: string, name: string) {
    const phone = phones.value.find(item => item.id === id)
    const value = name.trim()
    if (!phone || !value || value === phone.name) {
      return
    }
    // 先写入存储，保存失败时保留原名称。
    localStorage.setItem(STORAGE_KEY, JSON.stringify(phones.value.map(item => item.id === id ? { ...item, name: value } : item)))
    phone.name = value
  }

  function addTag(name: string, color: string) {
    const value = name.trim()
    if (!value || !defaultColors.includes(color) || phoneTags.value.some(tag => tag.name.toLowerCase() === value.toLowerCase())) {
      throw new Error('Invalid cloud phone tag')
    }
    const tag = { name: value, color }
    const next = [...phoneTags.value, tag]
    localStorage.setItem(TAGS_KEY, JSON.stringify(next))
    phoneTags.value = next
    return tag
  }

  function updatePhoneTags(id: string, tags: string[]) {
    const phone = phones.value.find(item => item.id === id)
    if (!phone) {
      return
    }
    const next = [...new Set(tags)]
    localStorage.setItem(TAGS_KEY, JSON.stringify(phoneTags.value))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(phones.value.map(item => item.id === id ? { ...item, tags: next } : item)))
    phone.tags = next
  }

  function toggleStatus(phone: CloudPhoneItem) {
    const current = phones.value.find(item => item.id === phone.id)
    if (current) {
      batchSetStatus([current.id], current.status === 'running' ? 'close' : 'open')
    }
  }

  function moveToTrash(phone: CloudPhoneItem) {
    batchMoveToTrash([phone.id])
  }

  function addOperationLogs(targets: CloudPhoneItem[], action: string, time: string) {
    logs.value.unshift(...targets.map(phone => ({
      id: `log_${crypto.randomUUID()}`,
      action,
      phoneName: phone.name,
      operator: phone.operator,
      time,
      status: 'success' as const,
    })))
  }

  /** 以当前记录为准，批量开关保持幂等，避免混合状态被逐项反转。 */
  function batchSetStatus(ids: string[], action: 'open' | 'close' | 'restart') {
    const selected = new Set(ids)
    const status = action === 'close' ? 'stopped' : 'running'
    const targets = phones.value.filter(phone => selected.has(phone.id) && (action === 'restart' || phone.status !== status))
    if (!targets.length) {
      return 0
    }
    const targetIds = new Set(targets.map(phone => phone.id))
    const time = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const next = phones.value.map<CloudPhoneItem>(phone => targetIds.has(phone.id)
      ? { ...phone, status, ...(status === 'running' ? { lastOpened: time } : {}) }
      : phone)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    phones.value = next
    addOperationLogs(targets, { open: 'Start Cloud Phone', close: 'Stop Cloud Phone', restart: 'Restart Cloud Phone' }[action], time)
    return targets.length
  }

  function batchMoveToTrash(ids: string[]) {
    const selected = new Set(ids)
    const targets = phones.value.filter(phone => selected.has(phone.id))
    if (!targets.length) {
      return 0
    }
    const nextPhones = phones.value.filter(phone => !selected.has(phone.id))
    const nextTrash = [...targets, ...trash.value.filter(phone => !selected.has(phone.id))]
    // 先保留可恢复副本，再移出列表；失败时还原存储，内存状态不提前更新。
    const previousTrash = localStorage.getItem(TRASH_KEY)
    localStorage.setItem(TRASH_KEY, JSON.stringify(nextTrash))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPhones))
    }
    catch (error) {
      if (previousTrash === null) {
        localStorage.removeItem(TRASH_KEY)
      }
      else {
        localStorage.setItem(TRASH_KEY, previousTrash)
      }
      throw error
    }
    phones.value = nextPhones
    trash.value = nextTrash
    addOperationLogs(targets, 'Delete Cloud Phone', new Date().toISOString().replace('T', ' ').slice(0, 19))
    return targets.length
  }

  function batchChangeProxy(ids: string[], proxy: Record<string, unknown>) {
    const selected = new Set(ids)
    const targets = phones.value.filter(phone => selected.has(phone.id))
    if (!targets.length) {
      return 0
    }
    const direct = proxy.proxyMethod === 'noproxy'
    const next = phones.value.map(phone => selected.has(phone.id)
      ? {
          ...phone,
          proxyInfo: JSON.parse(JSON.stringify(proxy)),
          proxyLocation: direct ? '--' : [proxy.lastCountry, proxy.lastCity].filter(Boolean).join('/') || '--',
          proxyIp: direct ? '--' : String(proxy.lastIp || proxy.host || '--'),
        }
      : phone)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    phones.value = next
    addOperationLogs(targets, 'Change Cloud Phone Proxy', new Date().toISOString().replace('T', ' ').slice(0, 19))
    return targets.length
  }

  function restoreFromTrash(phone: CloudPhoneItem) {
    trash.value = trash.value.filter(p => p.id !== phone.id)
    phones.value.push(phone)
    syncStorage()
  }

  function deletePermanently(phone: CloudPhoneItem) {
    trash.value = trash.value.filter(p => p.id !== phone.id)
    syncStorage()
  }

  function clearAllPhones() {
    phones.value = []
    syncStorage()
  }

  function resetToDefault() {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(TRASH_KEY)
    phones.value = getInitialPhones()
    trash.value = []
    syncStorage()
  }

  return {
    phones,
    trash,
    logs,
    groups,
    phoneTags,
    searchQuery,
    selectedGroup,
    filteredPhones,
    addPhone,
    renamePhone,
    addTag,
    updatePhoneTags,
    toggleStatus,
    moveToTrash,
    batchSetStatus,
    batchMoveToTrash,
    batchChangeProxy,
    restoreFromTrash,
    deletePermanently,
    clearAllPhones,
    resetToDefault,
  }
}
