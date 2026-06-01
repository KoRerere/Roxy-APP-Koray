(async () => {
  // 连接到已运行的 Firefox BiDi WebSocket
  // 注意：Firefox BiDi 只允许一个会话。若遇到 "Maximum number of active sessions"，
  // 说明存在僵尸会话（上次脚本未正常退出），需要重启 Firefox 一次清除。
  const wsUrl = 'ws://127.0.0.1:55049'

  console.log(`Connecting to: ${wsUrl}/session`)

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}/session`)
    let sessionActive = false
    let nextCommandId = 1
    const pendingCommands = new Map<number, { resolve: (value: any) => void, reject: (reason?: unknown) => void }>()

    /**
     * 进程退出时确保关闭连接，释放 Firefox 侧的会话
     */
    const cleanup = () => ws.readyState === WebSocket.OPEN && ws.close()
    process.on('exit', cleanup)
    process.on('SIGINT', () => { cleanup(); process.exit(0) })

    ws.onopen = () => {
      console.log('WebSocket connected, creating BiDi session...')
      // BiDi 协议要求先通过 session.new 创建会话，之后的命令才有效
      ws.send(JSON.stringify({ id: 0, method: 'session.new', params: { capabilities: {} } }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string)
      console.log('Received:', JSON.stringify(msg, null, 2))

      // 处理 session.new 响应
      if (msg.id === 0) {
        if (msg.type === 'success') {
          console.log('Session created, sending commands...')
          sessionActive = true
          sendCommands()
        }
        else if (msg.type === 'error') {
          if (msg.error === 'session not created') {
            console.error(
              '\n[错误] Firefox 存在僵尸会话，无法创建新会话。\n'
              + '请重启 Firefox 后重试（本脚本退出后会自动清理会话，下次不会再有此问题）。\n',
            )
          }
          else {
            console.error(`[错误] ${msg.error}: ${msg.message}`)
          }
          ws.close()
          reject(new Error(msg.message))
        }
        return
      }

      // 处理后续命令响应
      if (typeof msg.id === 'number' && pendingCommands.has(msg.id)) {
        const pending = pendingCommands.get(msg.id)
        pendingCommands.delete(msg.id)

        if (msg.type === 'success') {
          pending?.resolve(msg.result)
        }
        else {
          pending?.reject(new Error(`${msg.error}: ${msg.message}`))
        }
        return
      }

      // 打印其他命令的错误
      if (msg.type === 'error') {
        console.error(`[命令错误] id=${msg.id} ${msg.error}: ${msg.message}`)
      }
    }

    function sendBiDiCommand(method: string, params: Record<string, unknown>) {
      const id = nextCommandId++
      return new Promise<any>((resolveCommand, rejectCommand) => {
        pendingCommands.set(id, { resolve: resolveCommand, reject: rejectCommand })
        ws.send(JSON.stringify({ id, method, params }))
        console.log(`Sent: ${method}`)
      })
    }

    async function sendCommands() {
      try {
        // 动态创建新标签页
        const createResult = await sendBiDiCommand('browsingContext.create', { type: 'tab' })
        const context = createResult.context as string
        console.log(`Created tab context: ${context}`)

        // 在新标签页打开 baidu.com
        await sendBiDiCommand('browsingContext.navigate', {
          context,
          url: 'https://www.baidu.com',
          wait: 'complete',
        })
        console.log('Opened: https://www.baidu.com')

        await new Promise(resolve => setTimeout(resolve, 2000)) // 等待页面加载完成

        // 结束会话并关闭连接，避免留下僵尸会话
        await sendBiDiCommand('session.end', {})
        ws.close()
        resolve()
      }
      catch (err) {
        reject(err)
        ws.close()
      }
    }

    ws.onerror = () => console.error('WebSocket error')

    ws.onclose = () => {
      console.log('WebSocket closed')
      if (!sessionActive) {
        reject(new Error('Connection closed before session was established'))
      }
    }
  }).catch(err => console.error('Failed:', err))
})()
