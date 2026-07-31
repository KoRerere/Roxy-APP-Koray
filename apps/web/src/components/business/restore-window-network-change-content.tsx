import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { strConcat } from '/@/utils'

export interface ClientNetworkSnapshot {
  ip: string
  country: string
  country_code: string
  city: string
}

interface RestoreWindowNetworkChangeContentProps {
  previous: ClientNetworkSnapshot
  current: ClientNetworkSnapshot
}

/** 格式化 IP 位置展示：国家码/城市 */
function formatNetworkLocation(snapshot: ClientNetworkSnapshot) {
  const code = snapshot.country_code?.toUpperCase() || snapshot.country || '--'
  const city = snapshot.city || '--'
  return `${code}${strConcat('/', city)}`
}

/** 恢复窗口前客户端 IP 变化对比内容 */
export function RestoreWindowNetworkChangeContent(props: RestoreWindowNetworkChangeContentProps) {
  const previousLocation = formatNetworkLocation(props.previous)
  const currentLocation = formatNetworkLocation(props.current)

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <div class="flex flex-1 items-start gap-1.5 rounded-md bg-[var(--colors-background-bg-block)] px-4 py-3">
          <RxSvgIcon
            class="size-6 shrink-0 opacity-40"
            fallback="base/rx_ic_earth"
            name={`country-code/${props.previous.country_code?.toUpperCase() || props.previous.country}` as any}
          />
          <div class="flex min-w-0 flex-col gap-1.5 text-16px font-600 text-[var(--colors-text-text-inactive)]">
            <div class="ellipsis-1 leading-6">{previousLocation}</div>
            <div class="ellipsis-1">{`IP: ${props.previous.ip}`}</div>
          </div>
        </div>

        <RxSvgIcon class="size-4 shrink-0" name="base/rx_ic_arrow_right" color="#7D8387" />

        <div class="flex flex-1 items-start gap-1.5 rounded-md bg-[var(--colors-background-bg-info)] px-4 py-3">
          <RxSvgIcon
            class="size-6 shrink-0"
            fallback="base/rx_ic_earth"
            name={`country-code/${props.current.country_code?.toUpperCase() || props.current.country}` as any}
          />
          <div class="flex min-w-0 flex-col gap-1.5 text-16px font-600">
            <div class="ellipsis-1 leading-6 text-[var(--colors-text-text-primary)]">{currentLocation}</div>
            <div class="ellipsis-1 text-[var(--colors-text-text-brand)]">{`IP: ${props.current.ip}`}</div>
          </div>
        </div>
      </div>

      <div class="text-13px leading-[20.8px] text-[var(--colors-text-text-primary)]">
        <p class="mb-0">
          {$t('您的 IP 地址已变化，当前 IP 位置：{city}，当前 IP：{ip}。', {
            city: currentLocation,
            ip: props.current.ip,
          })}
        </p>
        <p class="mb-0 font-700">{$t('是否继续恢复窗口？')}</p>
      </div>
    </div>
  )
}
