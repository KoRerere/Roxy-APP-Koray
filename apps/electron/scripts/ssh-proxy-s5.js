const socks = require('socksv5')
const { Client } = require('ssh2')

const sshConfig = {
  host: '45.77.170.76',
  port: 22,
  username: 'root',
  password: ')5sCv(=kA+-#7!Mu',
}

function get_ssh_proxy_config(port) {
  return sshConfig
}

const srv = socks.createServer((info, accept, deny) => {
  const conn = new Client()
  console.log('connect:', info)
  const listen_port = srv.address().port
  // 1. 根据端口获取ssh代理的配置； 这种方案，每个窗口要监听一个端口，性能比较低
  // 2. 根据账号密码来获取ssh代理配置，这种只需要监听一个端口，难点怎么把账号密码传到这里来？
  const ssh_proxy_conf = get_ssh_proxy_config(listen_port)
  conn.on('ready', () => {
    conn.forwardOut(info.srcAddr, info.srcPort, info.dstAddr, info.dstPort, (err, stream) => {
      if (err) {
        conn.end()
        return deny()
      }

      const clientSocket = accept(true)
      if (clientSocket) {
        stream.pipe(clientSocket).pipe(stream).on('close', () => {
          conn.end()
        })
      }
      else {
        conn.end()
      }
    })
  }).on('error', (err) => {
    deny()
  }).connect(ssh_proxy_conf)
})

srv.listen(0, '127.0.0.1', () => {
  // srv.address() 拿到自动分配的socks5代理端口，填入指纹文件
  console.log('SOCKS server listening on ', srv.address().port)
})

srv.useAuth(socks.auth.UserPassword((user, password, cb) => {
  // 这里拿到账号密码， 怎么往下面的流程传递？
  console.log(`user:${user},password:${password}`)
  cb(true)
}))
