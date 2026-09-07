let control

const STORAGE_KEY = 'automationControl'

async function loadControl() {
  const stored = await chrome.storage.session.get(STORAGE_KEY)
  control = stored[STORAGE_KEY]
  if (control && !Array.isArray(control.originalTabs)) {
    control = undefined
  }
}

async function saveControl() {
  if (control) {
    await chrome.storage.session.set({ [STORAGE_KEY]: control })
  }
  else {
    await chrome.storage.session.remove(STORAGE_KEY)
  }
}

async function tabExists(tabId) {
  try {
    await chrome.tabs.get(tabId)
    return true
  }
  catch {
    return false
  }
}

async function groupExists(groupId) {
  if (groupId < 0) {
    return false
  }
  try {
    await chrome.tabGroups.get(groupId)
    return true
  }
  catch {
    return false
  }
}

async function resolveTargetTab(targetId) {
  const targets = await chrome.debugger.getTargets()
  const target = targets.find(item => (
    (item.id === targetId || item.targetId === targetId)
    && typeof item.tabId === 'number'
  ))
  if (!target) {
    throw new Error(`target tab is unavailable: ${targetId}`)
  }
  return chrome.tabs.get(target.tabId)
}

async function rememberTab(tab) {
  if (!control || control.originalTabs.some(item => item.tabId === tab.id)) {
    return
  }
  const original = { tabId: tab.id, groupId: tab.groupId }
  if (tab.groupId >= 0) {
    try {
      const group = await chrome.tabGroups.get(tab.groupId)
      Object.assign(original, {
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
      })
    }
    catch {}
  }
  control.originalTabs.push(original)
}

async function updateControlGroup() {
  if (!control || !(await groupExists(control.groupId))) {
    return
  }
  await chrome.tabGroups.update(control.groupId, {
    title: control.label,
    color: 'pink',
    collapsed: false,
  })
}

async function groupTargetTab(tab) {
  if (!control || !tab?.id) {
    throw new Error('target tab is unavailable')
  }
  await rememberTab(tab)
  if (await groupExists(control.groupId)) {
    await chrome.tabs.group({ groupId: control.groupId, tabIds: [tab.id] })
  }
  else {
    control.groupId = await chrome.tabs.group({ tabIds: [tab.id] })
  }
  await updateControlGroup()
}

async function restoreTabs() {
  if (!control) {
    return
  }
  const recreatedGroups = new Map()
  for (const original of control.originalTabs) {
    if (!(await tabExists(original.tabId))) {
      continue
    }
    try {
      if (original.groupId < 0) {
        await chrome.tabs.ungroup([original.tabId])
        continue
      }
      if (await groupExists(original.groupId)) {
        await chrome.tabs.group({ groupId: original.groupId, tabIds: [original.tabId] })
        continue
      }
      let groupId = recreatedGroups.get(original.groupId)
      if (groupId === undefined) {
        groupId = await chrome.tabs.group({ tabIds: [original.tabId] })
        recreatedGroups.set(original.groupId, groupId)
        await chrome.tabGroups.update(groupId, {
          title: original.title,
          color: original.color,
          collapsed: original.collapsed,
        })
      }
      else {
        await chrome.tabs.group({ groupId, tabIds: [original.tabId] })
      }
    }
    catch {}
  }
}

async function resetTarget() {
  await restoreTabs()
  control.groupId = -1
  control.targetId = undefined
  control.tabId = undefined
  control.originalTabs = []
}

async function sync(payload) {
  const executionId = String(payload.executionId || '').trim()
  const targetId = String(payload.targetId || '').trim()
  const label = String(payload.label || 'AI').trim()
  if (!executionId || !targetId || !label) {
    throw new Error('invalid sync payload')
  }

  const targetTab = await resolveTargetTab(targetId)
  if (!targetTab.id) {
    throw new Error(`target tab is unavailable: ${targetId}`)
  }

  if (control && control.executionId !== executionId) {
    await restoreTabs()
    control = undefined
  }
  if (!control) {
    control = {
      executionId,
      label,
      targetId,
      tabId: targetTab.id,
      windowId: targetTab.windowId,
      groupId: -1,
      originalTabs: [],
    }
  }
  else if (control.targetId !== targetId || control.tabId !== targetTab.id) {
    await resetTarget()
    control.targetId = targetId
    control.tabId = targetTab.id
    control.windowId = targetTab.windowId
  }
  control.label = label
  await groupTargetTab(targetTab)
  await saveControl()
  return { acquired: true, targetId, tabId: targetTab.id }
}

async function acquire(payload) {
  const executionId = String(payload.executionId || '').trim()
  const label = String(payload.label || 'AI').trim()
  if (!executionId || !label) {
    throw new Error('invalid acquire payload')
  }
  const browserWindow = await chrome.windows.getLastFocused()
  const [activeTab] = await chrome.tabs.query({ active: true, windowId: browserWindow.id })
  if (!activeTab?.id) {
    throw new Error('active tab is unavailable')
  }

  // Kept solely for older agents. New agents always call sync with their CDP target.
  if (control && control.executionId !== executionId) {
    await restoreTabs()
    control = undefined
  }
  if (!control) {
    control = {
      executionId,
      label,
      tabId: activeTab.id,
      windowId: activeTab.windowId,
      groupId: -1,
      originalTabs: [],
    }
  }
  else if (control.tabId !== activeTab.id) {
    await resetTarget()
    control.tabId = activeTab.id
    control.windowId = activeTab.windowId
  }
  control.label = label
  await groupTargetTab(activeTab)
  await saveControl()
  return { acquired: true, legacy: true }
}

async function release(payload) {
  const executionId = String(payload.executionId || '').trim()
  if (!control || control.executionId !== executionId) {
    return { released: false }
  }
  await restoreTabs()
  control = undefined
  await saveControl()
  return { released: true }
}

const ready = loadControl()

globalThis.roxyAutomationControl = {
  async request(action, payload = {}) {
    await ready
    if (action === 'acquire') {
      return acquire(payload)
    }
    if (action === 'sync') {
      return sync(payload)
    }
    if (action === 'release') {
      return release(payload)
    }
    throw new Error(`unsupported automation action: ${action}`)
  },
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!control) {
    return
  }
  control.originalTabs = control.originalTabs.filter(item => item.tabId !== tabId)
  if (control.tabId === tabId) {
    control.groupId = -1
  }
  void saveControl()
})
