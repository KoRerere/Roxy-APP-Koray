interface WindowDisplayRow {
  dirId?: string
  country?: string
  lastCountry?: string
  openStatus?: boolean
  windowName?: string
  windowRemark?: string
}

export function mergeAgentWindowOpenStatus<T extends WindowDisplayRow>(
  row: T,
  openedWindowIds: ReadonlySet<string>,
) {
  return {
    ...row,
    openStatus: Boolean(row.openStatus || (row.dirId && openedWindowIds.has(row.dirId))),
  }
}

export function getAgentWindowCountryIcon(row: WindowDisplayRow) {
  const countryCode = (row.lastCountry || row.country || '').trim()

  return countryCode ? `country-code/${countryCode.toUpperCase()}` : ''
}

export function getAgentWindowDisplay(row: WindowDisplayRow) {
  return {
    iconName: getAgentWindowCountryIcon(row),
    isOpen: Boolean(row.openStatus),
    name: row.windowName ?? '',
    remark: row.windowRemark ?? '',
  }
}
