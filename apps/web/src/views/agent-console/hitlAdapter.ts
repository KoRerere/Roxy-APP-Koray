import type { AgentClarificationQuestion, AgentHitlChoiceOption, AgentHitlControl, AgentHitlControlValue, AgentHitlRequest, AgentHitlSubject, AgentHitlSubmitPayload } from './types'
import { friendlyToolName, originalToolName } from './toolName'

export interface LegacyAgentHitlInterrupt {
  interruptsId?: unknown
  actionRequests?: unknown
  reviewConfigs?: unknown
}

export interface HitlRequestPresentation {
  actionTitles?: readonly (string | undefined)[]
}

export interface LegacyAgentHitlResumeDecision {
  type: 'approve' | 'reject' | 'edit' | 'answer'
  fullAccess?: boolean
  reason?: string
  answer?: string
  editedAction?: {
    name: string
    args: unknown
  }
}

interface LegacyActionRequest {
  name: string
  args: unknown
  diff?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function normalizeControl(value: unknown): AgentHitlControl | undefined {
  const control = asRecord(value)
  const id = asString(control.id)
  const kind = asString(control.kind)
  if (!id) {
    return undefined
  }

  if (kind === 'choice') {
    const options: AgentHitlChoiceOption[] = Array.isArray(control.options)
      ? control.options.map((option): AgentHitlChoiceOption | undefined => {
          const rawOption = asRecord(option)
          const optionId = asString(rawOption.id)
          const label = asString(rawOption.label)
          if (!optionId || !label) {
            return undefined
          }

          const variant = rawOption.variant === 'primary' || rawOption.variant === 'secondary' || rawOption.variant === 'danger'
            ? rawOption.variant
            : undefined
          const legacyDecisionType = rawOption.legacyDecisionType === 'approve' || rawOption.legacyDecisionType === 'reject' || rawOption.legacyDecisionType === 'edit'
            ? rawOption.legacyDecisionType
            : undefined

          return {
            id: optionId,
            label,
            value: normalizeControlValue(rawOption.value),
            variant,
            legacyDecisionType,
          }
        }).filter((option): option is NonNullable<typeof option> => Boolean(option))
      : []

    if (!options.length) {
      return undefined
    }

    return {
      id,
      kind,
      label: asString(control.label) || undefined,
      required: control.required === true,
      options,
    }
  }

  if (kind === 'text' || kind === 'textarea') {
    return {
      id,
      kind,
      label: asString(control.label) || undefined,
      required: control.required === true,
      placeholder: asString(control.placeholder) || undefined,
      defaultValue: asString(control.defaultValue) || undefined,
    }
  }
}

function normalizeControlValue(value: unknown): AgentHitlControlValue {
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  return null
}

function normalizeSubject(value: unknown, index: number): AgentHitlSubject | undefined {
  const subject = asRecord(value)
  const title = asString(subject.title)
  if (!title) {
    return undefined
  }

  return {
    id: asString(subject.id) || `subject-${index}`,
    title,
    name: asString(subject.name) || undefined,
    description: asString(subject.description) || undefined,
    input: subject.input,
    diff: asString(subject.diff) || undefined,
  }
}

function normalizeClarificationQuestion(value: unknown): AgentClarificationQuestion | undefined {
  const question = asRecord(value)
  const header = asString(question.header)
  const id = asString(question.id)
  const prompt = asString(question.question)
  const options = Array.isArray(question.options)
    ? question.options.map((option) => {
        const candidate = asRecord(option)
        const label = asString(candidate.label)
        const description = asString(candidate.description)
        return label && description ? { label, description } : undefined
      }).filter((option): option is AgentClarificationQuestion['options'][number] => Boolean(option))
    : []

  if (!header || header.length > 12 || !id || !prompt || options.length < 2 || options.length > 3) {
    return undefined
  }

  return { header, id, question: prompt, options }
}

function normalizeClarificationQuestions(value: unknown): AgentClarificationQuestion[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    return undefined
  }

  const questions = value.map(normalizeClarificationQuestion)
  return questions.every(Boolean) ? questions as AgentClarificationQuestion[] : undefined
}

function createHitlRequestFromFutureEvent(
  conversationId: string,
  runId: string,
  data: Record<string, unknown>,
): AgentHitlRequest | undefined {
  const clarificationQuestions = normalizeClarificationQuestions(data.questions)
  const controls = Array.isArray(data.controls)
    ? data.controls.map(normalizeControl).filter((control): control is AgentHitlControl => Boolean(control))
    : []

  if (!controls.length && !clarificationQuestions?.length) {
    return undefined
  }

  const requestId = asString(data.id) || asString(data.requestId) || asString(data.interruptsId) || `hitl-${conversationId}-${Date.now()}`
  const subjects = Array.isArray(data.subjects)
    ? data.subjects.map(normalizeSubject).filter((subject): subject is AgentHitlSubject => Boolean(subject))
    : []

  return {
    id: requestId,
    conversationId,
    runId,
    title: asString(data.title) || $t('请求批准'),
    prompt: clarificationQuestions?.[0]?.question || asString(data.prompt) || $t('RoxyAgent 需要您的输入才能继续'),
    description: asString(data.description) || undefined,
    status: 'pending',
    subjects,
    controls,
    values: isRecord(data.values)
      ? Object.fromEntries(Object.entries(data.values).map(([key, value]) => [key, normalizeControlValue(value)]))
      : {},
    ...(clarificationQuestions ? { clarificationQuestions } : {}),
    source: {
      kind: 'agent-hitl',
      payload: data,
    },
  }
}

function normalizeActions(value: unknown): LegacyActionRequest[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      const action = asRecord(item)
      const name = asString(action.name) || `action_${index + 1}`
      return {
        name,
        args: action.args,
        diff: asString(action.diff) || undefined,
      }
    })
}

function getBasename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).at(-1) || value
}

function getApplyPatchTargets(input: unknown): string[] {
  const record = asRecord(input)
  const operation = asRecord(record.operation)
  const operationPath = asString(operation.path)
  if (operationPath) {
    return [getBasename(operationPath)]
  }

  const patch = typeof input === 'string' ? input : asString(record.patch)

  const targets: string[] = []
  for (const line of patch.split(/\r?\n/)) {
    const header = /^\*\*\* (?:Add File|Update File|Delete File|Move to): /.exec(line)?.[0]
    const target = header ? line.slice(header.length).trim() : ''
    if (target) {
      targets.push(getBasename(target))
    }
  }
  return [...new Set(targets)]
}

function stringifyCompact(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

function getActionTarget(action: LegacyActionRequest) {
  const localName = originalToolName(action.name)
  if (localName === 'apply_patch') {
    return getApplyPatchTargets(action.args).join('、')
  }

  if (Array.isArray(action.args)) {
    const values = action.args.filter((value): value is string => typeof value === 'string' && value)
    if (values.length) {
      return values.join('、')
    }
  }

  const args = asRecord(action.args)
  const dirIds = Array.isArray(args.dirIds)
    ? args.dirIds.filter((value): value is string => typeof value === 'string' && value)
    : typeof args.dirId === 'string' && args.dirId
      ? [args.dirId]
      : []
  if (dirIds.length) {
    return dirIds.join('、')
  }

  const path = asString(args.file_path) || asString(args.path)
  if (path) {
    return getBasename(path)
  }

  const command = asString(args.cmd)
  if (command) {
    return command
  }

  const url = asString(args.url)
  if (url && localName !== 'browser_navigate' && localName !== 'browser_tabs') {
    return url
  }

  const firstValue = Object.values(args).find(value => value !== undefined && value !== null)
  return firstValue === undefined ? '' : stringifyCompact(firstValue)
}

function stripRunningPrefix(label: string): string {
  for (const prefix of [$t('正在'), '正在']) {
    if (prefix && label.startsWith(prefix)) {
      return label.slice(prefix.length)
    }
  }

  return label
}

function usesGenericToolFallback(label: string, localName: string): boolean {
  const genericPrefix = $t('使用工具：{name}', { name: '' })
  return Boolean(genericPrefix && label.startsWith(genericPrefix))
    || label === $t('使用工具：{name}', { name: localName })
}

function getActionLabel(action: LegacyActionRequest) {
  const localName = originalToolName(action.name)
  const label = friendlyToolName(action.name, 'running', action.args)
  if (usesGenericToolFallback(label, localName)) {
    return localName.replaceAll('_', ' ')
  }

  return stripRunningPrefix(label)
}

function labelAlreadySummarizesInput(action: LegacyActionRequest, label: string): boolean {
  return getActionLabel({ ...action, args: undefined }) !== label
}

function getActionTitle(action: LegacyActionRequest) {
  const label = getActionLabel(action)
  if (labelAlreadySummarizesInput(action, label)) {
    return label
  }

  const target = getActionTarget(action)
  return target && !label.includes(target) ? `${label} ${target}` : label
}

function getPresentedActionTitle(
  action: LegacyActionRequest,
  index: number,
  presentation: HitlRequestPresentation,
) {
  return presentation.actionTitles?.[index] || getActionTitle(action)
}

function getRequestPrompt(
  actions: LegacyActionRequest[],
  presentation: HitlRequestPresentation,
) {
  if (actions.length === 1) {
    const action = actions[0]!
    return $t('允许 Roxy Agent {verb} 吗？', {
      verb: getPresentedActionTitle(action, 0, presentation),
    })
  }

  return $t('允许 Roxy Agent 执行 {count} 项操作吗？', { count: actions.length })
}

export function createHitlRequestFromLegacyInterrupt(
  conversationId: string,
  runId: string,
  data: LegacyAgentHitlInterrupt,
  presentation: HitlRequestPresentation = {},
): AgentHitlRequest | undefined {
  const actions = normalizeActions(data.actionRequests)
  if (!actions.length) {
    return undefined
  }

  const requestId = asString(data.interruptsId) || `hitl-${conversationId}-${Date.now()}`

  return {
    id: requestId,
    conversationId,
    runId,
    title: $t('请求批准'),
    prompt: getRequestPrompt(actions, presentation),
    description: actions.length > 1
      ? actions.map((action, index) => getPresentedActionTitle(action, index, presentation)).join(', ')
      : undefined,
    status: 'pending',
    subjects: actions.map((action, index) => ({
      id: `${requestId}-subject-${index}`,
      title: getPresentedActionTitle(action, index, presentation),
      name: action.name,
      input: action.args,
      diff: action.diff,
    })),
    controls: [
      {
        id: 'approval',
        kind: 'choice',
        required: true,
        options: [
          {
            id: 'deny',
            label: $t('拒绝'),
            value: 'reject',
            variant: 'secondary',
            legacyDecisionType: 'reject',
          },
          {
            id: 'allow',
            label: $t('允许'),
            value: 'approve',
            variant: 'primary',
            legacyDecisionType: 'approve',
          },
          {
            id: 'full-access',
            label: $t('完全访问权限'),
            value: 'full-access',
            variant: 'primary',
            legacyDecisionType: 'approve',
          },
        ],
      },
    ],
    values: {
      approval: null,
    },
    source: {
      kind: 'legacy-agent-interrupt',
      payload: data,
    },
  }
}

export function createHitlRequestFromAgentEvent(
  conversationId: string,
  runId: string,
  data: unknown,
  presentation: HitlRequestPresentation = {},
): AgentHitlRequest | undefined {
  const payload = asRecord(data)
  return createHitlRequestFromFutureEvent(conversationId, runId, payload)
    ?? createHitlRequestFromLegacyInterrupt(conversationId, runId, payload, presentation)
}

function getLegacyDecisionType(request: AgentHitlRequest, values: Record<string, AgentHitlControlValue>) {
  const approvalValue = values.approval
  const approvalControl = request.controls.find(control => control.kind === 'choice' && control.id === 'approval')

  if (approvalControl?.kind === 'choice') {
    const option = approvalControl.options.find(option => option.value === approvalValue)
    if (option?.legacyDecisionType) {
      return option.legacyDecisionType
    }
  }

  return approvalValue === 'approve' ? 'approve' : 'reject'
}

export function createLegacyResumeDecisions(
  request: AgentHitlRequest,
  payload: AgentHitlSubmitPayload,
): LegacyAgentHitlResumeDecision[] {
  const sourcePayload = asRecord(request.source?.payload)
  if (request.source?.kind === 'agent-hitl' && sourcePayload.requestKind === 'clarification') {
    return [{ type: 'answer', answer: asString(payload.values.answer) }]
  }
  const decisionType = getLegacyDecisionType(request, payload.values)
  const actionCount = Math.max(1, request.subjects.length)

  return Array.from({ length: actionCount }, () => ({ type: decisionType }))
}
