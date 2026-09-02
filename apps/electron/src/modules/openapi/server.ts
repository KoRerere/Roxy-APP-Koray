import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export function listenOnPort(
  app: { listen: (port: number, host: string) => Server },
  port: number,
  onServer?: (server: Server) => void,
) {
  return new Promise<number>((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0')
    onServer?.(server)

    server.once('error', reject)
    server.once('listening', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address ? (address as AddressInfo).port : port)
    })
  })
}
