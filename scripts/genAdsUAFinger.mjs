function main() {
  const DB_NAME = 'FingerprintTestDB'
  const STORE_NAME = 'ua_results'
  const DB_VERSION = 1

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
          store.createIndex('os', 'os', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })
  }

  async function saveToIndexedDB(item) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const record = { ...item, createdAt: new Date().toISOString() }
      const request = store.add(record)
      request.onsuccess = () => { db.close(); resolve(request.result) }
      request.onerror = () => { db.close(); reject(request.error) }
    })
  }

  async function getAllFromIndexedDB() {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => { db.close(); resolve(request.result) }
      request.onerror = () => { db.close(); reject(request.error) }
    })
  }

  /**
   * 导出为 JSON：返回 JSON 字符串，并可选触发文件下载
   * @param {boolean} download - 为 true 时触发浏览器下载 JSON 文件
   * @returns {Promise<string>} JSON 字符串
   */
  async function exportToJSON(download = false) {
    const data = await getAllFromIndexedDB()
    const jsonStr = JSON.stringify(data, null, 2)
    if (download) {
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fingerprint-results-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
    return jsonStr
  }

  // 挂到全局，方便在控制台调用导出
  globalThis.exportFingerprintToJSON = exportToJSON

  const platforms = ['Windows', 'Mac OS X', 'Android', 'iOS']

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

  const platformMap = {
    'Mac OS X': 'macOS',
    'iOS': 'IOS',
  }

  const kernelVersions = ['144', '141', '138', '135']
  const result = []
  globalThis.adsResult = result

  async function genResult() {
    for (const platform of platforms) {
      try {
        await wait(2000)
        // 获取 UA
        const coreVersion = kernelVersions[Math.floor(Math.random() * kernelVersions.length)]
        const uaResponse = await $randGetUserAgentV2(platform, '', 'firefox', 'ua_auto', coreVersion)
        if (uaResponse.status === 200 && uaResponse.data.code === 0) {
          const { data: { data: uaData } } = uaResponse
          console.log('randGetUserAgentV2', uaData)
          const item = {
            platform: uaData.client_hints.platform,
            architecture: uaData.client_hints.architecture,
            platform_version: uaData.client_hints.platform_version,
            kernel_version: uaData.kernel_version,
            ua: uaData.ua,
          }
          result.push(item)
          await saveToIndexedDB(item)
        }
        else {
          console.error('uaResponse', uaResponse)
        }
      }
      catch (error) {
        console.error(error)
      }
    }
    await genResult()
  }

  genResult()
  console.log('result', result)
}

main()
