import type { PendingApproval } from "../core/interfaces.ts";

/**
 * Registry of pending approvals awaiting external resolution.
 * Used for the async suspend/resume path and external approval hooks.
 */
export class PendingApprovalRegistry {
  private readonly pending = new Map<string, PendingApproval>();

  add(pending: PendingApproval): void {
    this.pending.set(pending.traceId, pending);
  }

  get(traceId: string): PendingApproval | undefined {
    return this.pending.get(traceId);
  }

  remove(traceId: string): void {
    this.pending.delete(traceId);
  }

  list(): PendingApproval[] {
    return [...this.pending.values()];
  }
}
