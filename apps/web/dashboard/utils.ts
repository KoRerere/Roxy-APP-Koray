export function getTimeOffset() {
  const now = new Date()

  // 获取相对于 UTC 的时间偏移量（单位：分钟）
  const timezoneOffsetInMinutes = now.getTimezoneOffset()

  // 将偏移量转换为小时和分钟
  const offsetHours = Math.floor(timezoneOffsetInMinutes / 60)
  const offsetMinutes = Math.abs(timezoneOffsetInMinutes % 60)

  // 格式化偏移量为字符串
  const offsetSign = timezoneOffsetInMinutes > 0 ? '-' : '+'
  const formattedOffset = `${offsetSign}${String(Math.abs(offsetHours)).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`

  console.log(`当前时区偏移量: ${formattedOffset}`)
  return formattedOffset
}
