import { net } from 'electron'

Reflect.set(globalThis, 'fetch', net.fetch)