import type { ApprovalResult, IHITLHandler, ToolContext, ToolDescriptor, ToolResult } from '../core/interfaces.ts'
import type { ApprovalRequest } from '../core/interfaces.ts'

/** Build the request shared by interceptor, invoke, and streaming HITL paths. */
export async function buildApprovalRequest(
  descriptor: ToolDescriptor,
  input: unknown,
  traceId: string,
  options: {
    reason?: string
    previewInput?: unknown
    skipPreview?: boolean
  } = {},
): Promise<ApprovalRequest> {
  let diff: string | undefined
  if (descriptor.previewFn && !options.skipPreview) {
    try {
      const preview = await descriptor.previewFn(
        Object.prototype.hasOwnProperty.call(options, 'previewInput') ? options.previewInput : input,
      )
      if (preview && preview.length > 0) {
        diff = preview
      }
    } catch {
      // A preview is advisory and must never block the approval flow.
    }
  }

  return {
    toolName: descriptor.name,
    input,
    reason: options.reason ?? `Tool "${descriptor.name}" requires approval`,
    traceId,
    ...(diff !== undefined ? { diff } : {}),
  }
}

/**
 * Approval interceptor. Before executing a tool, if
 * {@link IHITLHandler.needsApproval} is true, calls `requestApproval`. On
 * reject, returns a `ToolResult{ isError, content: feedback }` so the model
 * sees the human correction instead of the tool output.
 */
export class HitlInterceptor {
  private readonly handler: IHITLHandler

  constructor(handler: IHITLHandler) {
    this.handler = handler
  }

  async intercept(
    descriptor: ToolDescriptor,
    input: unknown,
    ctx: ToolContext,
  ): Promise<{ approved: true } | { approved: false; result: ToolResult }> {
    if (!this.handler.needsApproval(descriptor, input)) {
      return { approved: true }
    }

    const request = await buildApprovalRequest(descriptor, input, ctx.traceId)
    const approval: ApprovalResult = await this.handler.requestApproval(request)

    if (approval.decision === 'approve') {
      if (approval.remember && this.handler.addRule) {
        this.handler.addRule(
          { match: approval.remember.toolPattern, sensitive: false },
          approval.remember.commandPattern,
        )
      }
      return { approved: true }
    }

    const feedback = approval.feedback ?? `Tool "${descriptor.name}" was rejected by HITL`
    return {
      approved: false,
      result: {
        toolUseId: ctx.traceId,
        content: feedback,
        isError: true,
      },
    }
  }
}

export type { ApprovalResult }
