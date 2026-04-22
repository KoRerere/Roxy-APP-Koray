import type { NekoClient } from '~/neko'

let currentClient: NekoClient | null = null

export function setClient(client: NekoClient) {
  currentClient = client
  window.$client = client
}

export function getClient() {
  if (!currentClient) {
    throw new Error('Roxy client has not been initialized.')
  }

  return currentClient
}
