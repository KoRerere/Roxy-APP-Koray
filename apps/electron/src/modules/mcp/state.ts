class McpRuntimeState {
  private mcpWindowOpen = false
  private roxyClawEnabled = false

  getMcpWindowOpen() {
    return this.mcpWindowOpen
  }

  setMcpWindowOpen(open: boolean) {
    this.mcpWindowOpen = open
  }

  getRoxyClawEnabled() {
    return this.roxyClawEnabled
  }

  setRoxyClawEnabled(enabled: boolean) {
    this.roxyClawEnabled = enabled
  }
}

export const mcpRuntimeState = new McpRuntimeState()
