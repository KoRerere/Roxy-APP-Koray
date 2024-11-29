import { CDPSession } from 'puppeteer-core';
import WebSocket from 'ws';

export class RxCDPSession extends CDPSession {
  private ws: WebSocket
  private messageQueueMap = new Map<string, Promise<any>>()

  constructor(public wsEndpoint: string) {
    super()
    this.ws = new WebSocket(wsEndpoint)
    this.initWsEvent()
  }

  private initWsEvent() {
    this.ws.on('message', this.handleMessage)
  }

  handleMessage = (data: string) => {
    console.log('received: %s', data)
  }

  async send(data: string) {
    this.ws.send(data)
  }

  async close() {
    this.ws.close()
  }
}
