class RoxyClient {
  constructor(port, token) {
    this.port = port
    this.token = token
    this.host = '127.0.0.1'
    this.url = `http://${this.host}:${this.port}`
  }

  _build_headers() {
    return { 'Content-Type': 'application/json', 'token': this.token }
  }

  async _post(path, data) {
    console.log(`http://${this.host}:${this.port}${path}`, data)
    const response = await fetch(`http://${this.host}:${this.port}${path}`, {
      method: 'post',
      body: JSON.stringify(data),
      headers: this._build_headers(),
      timeout: 10000,
    })
    return response.json()
  }

  async _get(path, data) {
    let parmas = ''
    if (data) {
      for (let k in data) {
        let v = data[k]
        if (parmas == '') {
          parmas = `${k}=${v}`
        }
        else {
          parmas = `${parmas}&${k}=${v}`
        }
      }
    }
    let base_url = `http://${this.host}:${this.port}${path}`
    // console.log(base_url)
    const response = await fetch(parmas == '' ? base_url : `${base_url}?${parmas}`, {
      headers: this._build_headers(),
      timeout: 10000,
    })
    return await response.json()
  }

  /**
   *
    健康检查,用于检查API服务是否正常运行
   */
  health() {
    return this._get('/health')
  }

  /**
   *
    获取工作空间项目列表,用于获取已拥有的空间和项目列表
    :param page_index,page_size 分页参数
   */
  workspace_project(self) {
    return this._get('/browser/workspace')
  }

  /**
   *
    获取账号列表,用于获取已配置的平台账号
    :param workspaceId: 工作空间id, 必填，指定要获取哪个空间下的平台账号，通过workspace_project方法获取
    :param accountId: 账号库id, 选填
    :param page_index,page_size 分页参数
   */
  account(self, workspaceId, accountId = 0, page_index = 1, page_size = 15) {
    return self._get('/browser/account', { workspaceId, accountId, page_index, page_size })
  }

  /**
   *
    获取标签列表,用于获取已配置的标签信息
    :param workspaceId: 工作空间id, 必填，指定要获取哪个空间下的标签，通过workspace_project方法获取
   */
  label(self, workspaceId) {
    return self._get('/browser/label', { workspaceId })
  }

  /**
   *
    获取窗口列表
    :param workspaceId: 工作空间id, 必填，指定要获取哪个空间下的窗口列表，通过workspace_project方法获取
    :param dirId: 窗口id, 选填；如果填了就只查询这个窗口的信息
    :param page_index,page_size 分页参数
    :res 返回值参考文档
   */
  browser_list(workspaceId, sortNums = '', page_index = 1, page_size = 15) {
    return this._get('/browser/list_v3', { workspaceId, sortNums, page_index, page_size })
  }

  /**
   *
    获取浏览器窗口明细
    :param workspaceId: 工作空间id, 必填，指定要获取哪个空间下的窗口明细，通过workspace_project方法获取
    :param dirId: 窗口id, 必填，指定要获取的窗口
    :res 返回值参考文档
   */
  browser_detail(workspaceId, dirId) {
    return this._get('/browser/detail', { workspaceId, dirId })
  }

  /**
   *
    创建窗口
    :param data: 创建窗口需要传的参数,参考文档说明，其中workspaceId为必传，通过workspace_project方法获取
    :res 返回值参考文档
   */
  browser_create(data = {}) {
    return this._post('/browser/create', data)
  }

  /**
   *
    修改窗口
    :param data: 修改窗口需要传的参数,参考文档说明，其中workspaceId和dirId为必传，workspaceId通过workspace_project方法获取
    :res 返回值参考文档
   */
  browser_mdf(data = {}) {
    return this._post('/browser/mdf', data)
  }

  /**
   *
    删除窗口
    :param workspaceId: 工作空间id, 必填，指定窗口所在的空间，通过workspace_project方法获取
    :param dirIds: 窗口id列表, 必填，指定要删除的浏览器窗口列表
    :res 返回值参考文档
   */
  browser_delete(workspaceId, dirid) {
    return this._post('/browser/delete', { workspaceId, dirIds: [dirid] })
  }

  /**
   *
    打开窗口
    :param dirId: 需要打开的窗口ID，必填
    :param args: 指定浏览器启动参数，选填
    :res 返回值参考文档
   */
  browser_open(dirId, args = []) {
    return this._post('/browser/open', { dirId, args })
  }

  /**
   *
    关闭窗口
    :param dirId: 需要关闭的窗口ID，必填
    :res 返回值参考文档
   */
  browser_close(dirId) {
    return this._post('/browser/close', { dirId })
  }

  /**
   *
    清空窗口本地缓存
    :param dirIds: 窗口id列表, 必填，指定要清空缓存的窗口列表
    :res 返回值参考文档
   */
  browser_clear_local_cache(dirid) {
    return this._post('/browser/clear_local_cache', { dirIds: [dirid] })
  }

  /**
   *
    清空窗口服务器缓存
    :param workspaceId: 工作空间id, 必填，指定窗口所在的空间，通过workspace_project方法获取
    :param dirIds: 窗口id列表, 必填，指定要清空缓存的窗口列表
    :res 返回值参考文档
   */
  browser_clear_server_cache(workspaceId, dirid) {
    return this._post('/browser/clear_server_cache', { workspaceId, dirIds: [dirid] })
  }

  /**
   *
    窗口随机指纹
    :param workspaceId: 工作空间id, 必填，指定窗口所在的空间，通过workspace_project方法获取
    :param dirId: 窗口id, 必填，指定需要随机指纹的窗口
    :res 返回值参考文档
   */
  browser_random_env(workspaceId, dirid) {
    return this._post('/browser/random_env', { workspaceId, dirId: dirid })
  }

  /**
   *
    获取已打开的浏览器信息
    :param dirIds: 需要查询的窗口ID，选填
    :res 返回值参考文档
   */
  browser_connection_info() {
    return this._get('/browser/connection_info')
  }
}

const client = new RoxyClient(50479, '5869995eb91e1a4ba81d868c7d61423a')
client._get('/browser/list_v3', {
  workspaceId: 19437,
}).then((res) => {
  console.log(res.data)
}).catch((err) => {
  console.log(err)
})
