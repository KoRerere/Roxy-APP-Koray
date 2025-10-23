/**
 * @module preload
 */

// import '@sentry/electron/preload'
import './polyfill'

import { contextBridge, webFrame, webUtils } from 'electron'

import type { MainMessage, RenderMessage } from './types/'

import { IPCRenderer } from './ipcRenderer'

export * from './types/'

const ipcRenderer = new IPCRenderer<RenderMessage, MainMessage>()

const electronAPI = {
  versions: process.versions,
  send: ipcRenderer.send,
  on: ipcRenderer.on,
  getPathForFile: (file: File) => {
    return webUtils.getPathForFile(file)
  },
  setZoomFactor: (factor: number) => {
    webFrame.setZoomFactor(factor)
  },
} as const

export type ElectronAPI = typeof electronAPI

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
