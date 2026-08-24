import type { IModelProvider } from 'roxy-agent-runtime'
import { BackgroundSummarizer } from 'roxy-agent-runtime'

/**
 * DeepSeek V4 advertises a 1M-token context window. The business runtime passes
 * an explicit compaction trigger into roxy-agent-runtime so experiments do not
 * require changing runtime defaults.
 */
export const DEEPSEEK_CONTEXT_WINDOW_TOKENS = 1_000_000
export const DEFAULT_COMPACTION_TRIGGER_RATIO = 0.5
export const FALLBACK_COMPACTION_TRIGGER_TOKENS = 150_000
export const DEEPSEEK_COMPACTION_TRIGGER_TOKENS = resolveRuntimeCompactionTriggerTokens(
  DEEPSEEK_CONTEXT_WINDOW_TOKENS,
)
/** Codex's remote v2 path retains a bounded recent-user budget of 64k. */
export const DEEPSEEK_COMPACTION_RETAINED_USER_TOKENS = 64_000

const COMPACTION_SUMMARY_INSTRUCTIONS = [
  'Summarize the previous transcript for the next assistant turn.',
  'Write a compact state record, not a narrative.',
  'Preserve exact facts that would help resume work: user intent, confirmed decisions, current goal, completed steps, unresolved blockers, tool outcomes, file paths, URLs, profile/session ids, selector or locator details, error messages, and the last known page/app state.',
  'Prefer concrete bullet points or short labeled lines such as "Goal", "Done", "State", "Failure", "Next".',
  'Do not invent new steps, conclusions, or progress.',
  'Do not include tool-call markup, DSML, XML, or simulated tool invocations.',
  'Do not paraphrase away identifiers, paths, URLs, or error strings.',
  'If something is uncertain, say it is uncertain instead of guessing.',
  'Keep it concise but faithful.',
  'Return only the summary inside <summary></summary>.',
].join(' ')

function resolveRuntimeCompactionTriggerTokens(contextWindowTokens: number | undefined): number {
  return contextWindowTokens === undefined
    ? FALLBACK_COMPACTION_TRIGGER_TOKENS
    : Math.floor(contextWindowTokens * DEFAULT_COMPACTION_TRIGGER_RATIO)
}

/** Runtime chat memory policy for the DeepSeek Responses endpoint. */
export function createRuntimeCompactionOptions(provider: IModelProvider, model: string) {
  const contextWindowTokens = provider.contextWindowTokens

  return {
    // Pass the business experiment threshold explicitly instead of relying on
    // roxy-agent-runtime's built-in default.
    trimPolicy: {
      mode: 'codex' as const,
      keep: DEEPSEEK_COMPACTION_RETAINED_USER_TOKENS,
      retention: 'codex' as const,
      retainedUserTokens: DEEPSEEK_COMPACTION_RETAINED_USER_TOKENS,
    },
    ...(contextWindowTokens !== undefined ? { contextWindowTokens } : {}),
    triggerTokens: resolveRuntimeCompactionTriggerTokens(contextWindowTokens),
    summarizer: new BackgroundSummarizer(provider, model, {
      maxTokens: 2_048,
      instructions: COMPACTION_SUMMARY_INSTRUCTIONS,
    }),
  }
}
