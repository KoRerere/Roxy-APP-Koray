import type { ApprovalResult, IHITLHandler, ToolContext, ToolDescriptor, ToolResult } from "../core/interfaces.ts";

/**
 * Approval interceptor. Before executing a tool, if
 * {@link IHITLHandler.needsApproval} is true, calls `requestApproval`. On
 * reject, returns a `ToolResult{ isError, content: feedback }` so the model
 * sees the human correction instead of the tool output.
 */
export class HitlInterceptor {
  private readonly handler: IHITLHandler;

  constructor(handler: IHITLHandler) {
    this.handler = handler;
  }

  async intercept(
    descriptor: ToolDescriptor,
    input: unknown,
    ctx: ToolContext,
  ): Promise<{ approved: true } | { approved: false; result: ToolResult }> {
    if (!this.handler.needsApproval(descriptor, input)) {
      return { approved: true };
    }

    // Compute diff preview if the tool supports it; errors are silently ignored.
    let diff: string | undefined;
    if (descriptor.previewFn) {
      try {
        const preview = await descriptor.previewFn(input);
        if (preview && preview.length > 0) diff = preview;
      } catch {
        // intentionally swallowed — a missing diff never blocks approval
      }
    }

    const approval: ApprovalResult = await this.handler.requestApproval({
      toolName: descriptor.name,
      input,
      reason: `Tool "${descriptor.name}" requires approval`,
      traceId: ctx.traceId,
      ...(diff !== undefined ? { diff } : {}),
    });

    if (approval.decision === "approve") {
      if (approval.remember && this.handler.addRule) {
        this.handler.addRule(
          { match: approval.remember.toolPattern, sensitive: false },
          approval.remember.commandPattern,
        );
      }
      return { approved: true };
    }

    const feedback = approval.feedback ?? `Tool "${descriptor.name}" was rejected by HITL`;
    return {
      approved: false,
      result: {
        toolUseId: ctx.traceId,
        content: feedback,
        isError: true,
      },
    };
  }
}

export type { ApprovalResult };
