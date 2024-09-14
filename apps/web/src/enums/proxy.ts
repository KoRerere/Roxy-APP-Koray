export enum ProxyCheckStatus {
  none = 0, // 没有测试
  success = 1, // 测试成功
  failure = 2, // 检测失败
}

export enum ProxyProtocol {
  HTTP = 'HTTP',
  HTTPS = 'HTTPS',
  SOCKS5 = 'SOCKS5',
}
