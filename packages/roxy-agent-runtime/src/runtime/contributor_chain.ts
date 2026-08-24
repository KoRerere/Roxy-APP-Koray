import type { ContextContribution, ContributorContext, IContextContributor, ILogger } from '../core/interfaces.ts'

/**
 * Await each contributor in order; catch errors individually (log + return `[]`
 * for that contributor). Returns all contributions concatenated.
 *
 * This is the extracted unit of `agent.ts`'s inline contributor loop — pulled
 * out here so it can be tested independently.
 */
export async function runContributors(
  contributors: IContextContributor[],
  ctx: ContributorContext,
  logger?: ILogger,
): Promise<ContextContribution[]> {
  const contributions: ContextContribution[] = []
  for (const contributor of contributors) {
    try {
      const contributed = await contributor.contribute(ctx)
      contributions.push(...contributed)
    } catch (err) {
      logger?.warn('context contributor threw — context skipped', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return contributions
}
