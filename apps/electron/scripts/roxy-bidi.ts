import child_process from 'node:child_process'

(async () => {
  const firefox = 'D:\\工作资料\\火狐内核\\RoxyFirefox\\RoxyFirefox.exe'
  const user_data_dir = 'D:\\工作资料\\火狐内核\\RoxyFirefox\\firefox-user-data-dir'
  const process = child_process.spawn(firefox, [
    '-profile',
    user_data_dir,
    '--remote-debugging-port=0',
    'https://browserleaks.com',
    'https://browserleaks.com',
    'https://ip123.in',
  ])

  let wsUrl = null
  let wsConnected = false

  process.stdout.on('data', (data) => {
    console.log(data.toString())
  })

  process.stderr.on('data', (data) => {
    const output = data.toString()
    console.error(output)

    // 解析 WebDriver BiDi WebSocket URL
    if (!wsUrl && !wsConnected) {
      const match = output.match(/WebDriver BiDi listening on (ws:\/\/\S+)/)
      if (match) {
        wsUrl = match[1]

        console.log(`Found WebSocket URL: ${wsUrl}`)
        // 尝试通过 HTTP 获取会话信息，或直接连接
        tryConnectWebSocket(wsUrl).catch((err) => {
          console.error('Failed to connect:', err)
        })
      }
    }
  })

  async function tryConnectWebSocket(url: string) {
    try {
      // 直接使用 WebSocket 连接，因为 /session 端点只支持 WebSocket 协议
      // HTTP GET/POST 会返回错误：The handshake request has incorrect Upgrade header
      console.log('Connecting directly via WebSocket (HTTP not supported for /session endpoint)')
      await connectAndSendCommands(url)
    }
    catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  async function connectAndSendCommands(url) {
    return new Promise((resolve, reject) => {
      // 尝试不同的 WebSocket 路径
      // 注意：根据 Firefox 的实现，可能需要先连接到根路径，让服务器自动创建会话
      const urlsToTry = [
        `${url}/session`, // 先尝试 /session，因为之前这个连接成功了
        url, // 然后尝试根路径
        `${url}/bidi`, // 最后尝试 /bidi
      ]

      let currentIndex = 0

      function tryNextUrl() {
        if (currentIndex >= urlsToTry.length) {
          reject(new Error('All WebSocket URLs failed'))
          return
        }

        const currentUrl = urlsToTry[currentIndex]
        console.log(`Trying WebSocket URL: ${currentUrl}`)

        const ws = new WebSocket(currentUrl)

        let sessionInitialized = false
        let initMessageReceived = false

        ws.onopen = () => {
          console.log('WebSocket connected')
          wsConnected = true

          // 必须先发送 session.new 命令来创建会话
          console.log('Sending session.new to create session...')
          const sessionNewCommand = {
            id: 0,
            method: 'session.new',
            params: {
              capabilities: {},
            },
          }
          ws.send(JSON.stringify(sessionNewCommand))
          console.log('Sent: session.new')
        }

        /**
         * 监听消息，处理 session.new 的响应
         */
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            console.log('Received:', JSON.stringify(message, null, 2))

            // 检查是否是 session.new 的响应
            if (message.id === 0 && message.type === 'success') {
              // session.new 成功，会话已创建
              initMessageReceived = true
              console.log('Session created successfully via session.new')
              // 会话创建成功后，发送命令
              setTimeout(() => {
                sendCommands()
              }, 2000)
              return
            }

            // 处理其他错误
            if (message.type === 'error') {
              console.log(`Error: ${message.error} - ${message.message}`)
            }
          }
          catch (e) {
            console.log('Received (raw):', event.data)
          }
        }

        function sendCommands() {
          if (sessionInitialized) {
            return // 已经发送过了
          }
          sessionInitialized = true

          // 发送第一个命令: browser.getTabs
          const getTabsCommand = {
            id: 1,
            method: 'browser.getTabs',
            params: {},
          }
          ws.send(JSON.stringify(getTabsCommand))
          console.log('Sent: browser.getTabs')

          // 发送第二个命令: browser.setColor
          const setColorCommand = {
            id: 2,
            method: 'browser.setColor',
            params: {
              color: '#FF0000',
            },
          }
          ws.send(JSON.stringify(setColorCommand))
          console.log('Sent: browser.setColor')

          resolve(ws)
        }

        ws.onerror = (event) => {
          console.error(`WebSocket error for ${currentUrl}`)
        }

        ws.onclose = () => {
          console.log('WebSocket closed')
          wsConnected = false
          // 尝试下一个 URL
          if (!sessionInitialized) {
            currentIndex++
            if (currentIndex < urlsToTry.length) {
              console.log('Trying next URL...')
              setTimeout(tryNextUrl, 500)
            }
            else {
              reject(new Error('All WebSocket URLs failed'))
            }
          }
        }
      }

      tryNextUrl()
    })
  }
})()
