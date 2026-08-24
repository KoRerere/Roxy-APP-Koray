/** Build the model-facing name for one tool exposed by an MCP server. */
export function mcpToolName(serverName: string, toolName: string): string {
  return `mcp_${serverName}__${toolName}`
}

/** Build the prefix shared by every model-facing tool from one MCP server. */
export function mcpToolNamePrefix(serverName: string): string {
  return `mcp_${serverName}__`
}
