import type { AgentHitlControl, AgentHitlControlValue, AgentHitlRequest, AgentHitlSubject, AgentHitlSubmitPayload } from './types'

export interface LegacyAgentHitlInterrupt {
  interruptsId?: unknown
  actionRequests?: unknown
  reviewConfigs?: unknown
}

export interface LegacyAgentHitlResumeDecision {
  type: 'approve' | 'reject' | 'edit'
  reason?: string
  editedAction?: {
    name: string
    args: unknown
  }
}

interface LegacyActionRequest {
  name: string
  args: Record<string, unknown>
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
  if (!id)
    return undefined

  if (kind === 'choice') {
    const options = Array.isArray(control.options)
      ? control.options.map((option) => {
          const rawOption = asRecord(option)
          const optionId = asString(rawOption.id)
          const label = asString(rawOption.label)
          if (!optionId || !label)
            return undefined

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

    if (!options.length)
      return undefined

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
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
    return value

  return null
}

function normalizeSubject(value: unknown, index: number): AgentHitlSubject | undefined {
  const subject = asRecord(value)
  const title = asString(subject.title)
  if (!title)
    return undefined

  return {
    id: asString(subject.id) || `subject-${index}`,
    title,
    name: asString(subject.name) || undefined,
    description: asString(subject.description) || undefined,
    input: isRecord(subject.input) ? subject.input : undefined,
  }
}

function createHitlRequestFromFutureEvent(
  conversationId: string,
  runId: string,
  data: Record<string, unknown>,
): AgentHitlRequest | undefined {
  const controls = Array.isArray(data.controls)
    ? data.controls.map(normalizeControl).filter((control): control is AgentHitlControl => Boolean(control))
    : []

  if (!controls.length)
    return undefined

  const requestId = asString(data.id) || asString(data.requestId) || asString(data.interruptsId) || `hitl-${conversationId}-${Date.now()}`
  const subjects = Array.isArray(data.subjects)
    ? data.subjects.map(normalizeSubject).filter((subject): subject is AgentHitlSubject => Boolean(subject))
    : []

  return {
    id: requestId,
    conversationId,
    runId,
    title: asString(data.title) || $t('请求批准'),
    prompt: asString(data.prompt) || $t('RoxyAgent 需要您的输入才能继续'),
    description: asString(data.description) || undefined,
    status: 'pending',
    subjects,
    controls,
    values: isRecord(data.values)
      ? Object.fromEntries(Object.entries(data.values).map(([key, value]) => [key, normalizeControlValue(value)]))
      : {},
    source: {
      kind: 'agent-hitl',
      payload: data,
    },
  }
}

function normalizeActions(value: unknown): LegacyActionRequest[] {
  if (!Array.isArray(value))
    return []

  return value
    .map((item, index) => {
      const action = asRecord(item)
      const name = asString(action.name) || `action_${index + 1}`
      return {
        name,
        args: asRecord(action.args),
      }
    })
}

function getBasename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).at(-1) || value
}

function stringifyCompact(value: unknown) {
  if (typeof value === 'string')
    return value

  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

function getActionTarget(action: LegacyActionRequest) {
  const args = action.args
  const path = asString(args.file_path) || asString(args.path)
  if (path)
    return getBasename(path)

  const command = asString(args.command)
  if (command)
    return command

  const url = asString(args.url)
  if (url)
    return url

  const firstValue = Object.values(args).find(value => value !== undefined && value !== null)
  return firstValue === undefined ? '' : stringifyCompact(firstValue)
}

function getActionVerb(action: LegacyActionRequest) {
  switch (action.name) {
    case 'read_file':
      return $t('查看')
    case 'write_file':
    case 'edit_file':
      return $t('编辑')
    case 'execute':
      return $t('运行')
    default:
      return action.name.replaceAll('_', ' ')
  }
}

function getActionTitle(action: LegacyActionRequest) {
  const target = getActionTarget(action)
  const verb = getActionVerb(action)
  return target ? `${verb} ${target}` : verb
}

function getRequestPrompt(actions: LegacyActionRequest[]) {
  if (actions.length === 1) {
    const action = actions[0]!
    const target = getActionTarget(action)
    const verb = getActionVerb(action)
    return target
      ? $t('允许 RoxyAgent {verb} {target} 吗？', { verb, target })
      : $t('允许 RoxyAgent {verb} 吗？', { verb })
  }

  return $t('允许 RoxyAgent 执行 {count} 项操作吗？', { count: actions.length })
}

export function createHitlRequestFromLegacyInterrupt(
  conversationId: string,
  runId: string,
  data: LegacyAgentHitlInterrupt,
): AgentHitlRequest | undefined {
  const actions = normalizeActions(data.actionRequests)
  if (!actions.length)
    return undefined

  const requestId = asString(data.interruptsId) || `hitl-${conversationId}-${Date.now()}`

  return {
    id: requestId,
    conversationId,
    runId,
    title: $t('请求批准'),
    prompt: getRequestPrompt(actions),
    description: actions.length > 1 ? actions.map(getActionTitle).join(', ') : undefined,
    status: 'pending',
    subjects: actions.map((action, index) => ({
      id: `${requestId}-subject-${index}`,
      title: getActionTitle(action),
      name: action.name,
      input: action.args,
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
): AgentHitlRequest | undefined {
  const payload = asRecord(data)
  return createHitlRequestFromFutureEvent(conversationId, runId, payload)
    ?? createHitlRequestFromLegacyInterrupt(conversationId, runId, payload)
}

function getLegacyDecisionType(request: AgentHitlRequest, values: Record<string, AgentHitlControlValue>) {
  const approvalValue = values.approval
  const approvalControl = request.controls.find(control => control.kind === 'choice' && control.id === 'approval')

  if (approvalControl?.kind === 'choice') {
    const option = approvalControl.options.find(option => option.value === approvalValue)
    if (option?.legacyDecisionType)
      return option.legacyDecisionType
  }

  return approvalValue === 'approve' ? 'approve' : 'reject'
}

export function createLegacyResumeDecisions(
  request: AgentHitlRequest,
  payload: AgentHitlSubmitPayload,
): LegacyAgentHitlResumeDecision[] {
  const decisionType = getLegacyDecisionType(request, payload.values)
  const actionCount = Math.max(1, request.subjects.length)

  return Array.from({ length: actionCount }, () => ({ type: decisionType }))
}
