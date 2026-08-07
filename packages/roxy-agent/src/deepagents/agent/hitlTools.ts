const HITL_ALLOWED_DECISIONS = ['approve', 'reject']

export const HITL_DELETE_TOOLS = [
  // Legacy MCP names.
  'roxy_delete_browsers',
  'roxy_delete_proxies',
  'roxy_delete_accounts',
  // Current public names from roxybrowser-mcp-server V2 catalog.
  'roxy_browser_delete',
  'roxy_proxy_delete',
  'roxy_account_delete',
]

export const HITL_DELETE_INTERRUPT_ON: Record<string, { allowedDecisions: string[] }> = Object.fromEntries(
  HITL_DELETE_TOOLS.map(toolName => [
    toolName,
    { allowedDecisions: [...HITL_ALLOWED_DECISIONS] },
  ]),
)
