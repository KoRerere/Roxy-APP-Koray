import type { ToolDescriptor } from '../core/interfaces.ts'

/**
 * Internal approval policy built from standard tool annotations. A completely
 * unannotated tool is treated as non-sensitive; missing fields on an existing
 * annotations object use the MCP ToolAnnotations defaults.
 */
export function toolNeedsHumanApproval(tool: ToolDescriptor): boolean {
  const annotations = tool.annotations
  // An MCP tool that does not advertise annotations is explicitly treated as
  // non-sensitive. This keeps unannotated browser/read-only integrations
  // executable without introducing an approval gate by default.
  if (!annotations || Object.keys(annotations).length === 0) {
    return false
  }
  const openWorld = annotations?.openWorldHint !== false
  if (annotations?.readOnlyHint === true) {
    return openWorld
  }
  const destructive = annotations?.destructiveHint !== false
  return destructive || openWorld
}
