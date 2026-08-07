import type { AgentComposerSuggestionKind, AgentComposerTokenKind } from './types'
import { scanComposerProtocolTokens } from './protocol'

export interface AgentComposerSelectionBehavior {
  closeAfterChoose: boolean
  multiSelect: boolean
}

export type SuggestionNavigationDirection = 'next' | 'previous'

export function getComposerSelectionBehavior(kind: AgentComposerSuggestionKind): AgentComposerSelectionBehavior {
  return kind === 'mention'
    ? { closeAfterChoose: false, multiSelect: true }
    : { closeAfterChoose: true, multiSelect: false }
}

export function getNextSuggestionIndex(
  currentIndex: number,
  itemCount: number,
  direction: SuggestionNavigationDirection,
) {
  if (itemCount <= 0)
    return 0

  const normalizedIndex = Math.min(Math.max(currentIndex, 0), itemCount - 1)
  const offset = direction === 'next' ? 1 : -1
  return (normalizedIndex + offset + itemCount) % itemCount
}

export function getPromptTokenTargets(prompt: string, kind: AgentComposerTokenKind) {
  const targets = new Set<string>()

  for (const token of scanComposerProtocolTokens(prompt)) {
    if (token.kind !== kind) {
      continue
    }
    if ((kind === 'script' || kind === 'skill') && !token.templateRef) {
      continue
    }

    const nextTargets = kind === 'profile'
      ? splitProfileTargets(token.target)
      : [token.templateRef ?? token.target]
    nextTargets.forEach(nextTarget => targets.add(nextTarget))
  }

  return targets
}

function splitProfileTargets(target: string) {
  return target
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}
