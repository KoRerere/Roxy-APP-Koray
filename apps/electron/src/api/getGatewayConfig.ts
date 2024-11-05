import axios from 'axios'
import { isDev, isPackaged } from '/@/utils'

const gateConfUrls = ['https://gw.roxyip.com/get_gate_conf', 'https://gw.lumi-browser.com/get_gate_conf']
/**
 * 读取网关配置
 */
export async function getGatewayConfig(): Promise<string> {
  // if (isPackaged) {
  // TODO 临时处理
  // return 'http://47.239.9.178'
  // }

  for await (const url of gateConfUrls) {
    try {
      const response = await axios.get(url, {
        headers: {
          token: '112233998877rrttyy',
        },
      }).catch((error) => {
        console.log(`getGatewayConfig error`, error)
        return Promise.reject(error)
      })
      console.log(`getGatewayConfig response`, response.data)
      return isDev ? response.data.test : response.data.prod
    }
    catch (error) {
      console.log(`gatewayConfig error`, error)
    }
  }

  return isDev ? 'https://lumitest.lumibrowser.com' : 'https://lumigate.lumibrowser.com'
}
