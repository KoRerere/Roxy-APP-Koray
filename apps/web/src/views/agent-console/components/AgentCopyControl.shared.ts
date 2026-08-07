import { copyText } from '/@/utils/basic'

export const AGENT_COPY_ICON = 'base/rx_ic_copy'
export const AGENT_COPY_SUCCESS_ICON = 'base/rx_ic_check'
export const AGENT_COPY_SUCCESS_DURATION = 1200

export async function copyAgentText(text: string) {
  if (!text)
    return false

  await Promise.resolve(copyText(text))
  return true
}
