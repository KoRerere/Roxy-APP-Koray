export type MemoryToolAction = 'read' | 'write' | 'update'

export type MemoryToolPresentation
  = | { kind: 'hidden' }
    | { kind: 'entries', action: MemoryToolAction, count: number }

export interface MemoryToolMetadata {
  patchType?: 'create' | 'update' | 'delete' | 'mixed'
  target?: string
}

export interface MemoryToolEventLike extends MemoryToolMetadata {
  toolName: string
  input?: unknown
  status?: string
  finished?: boolean
}

export interface MemoryToolGroupSummary {
  action: MemoryToolAction
  count: number
  completed: boolean
}

type MemoryPathKind = 'directory' | 'index' | 'entry' | 'internal'

interface FileOperation {
  action: MemoryToolAction | 'discover'
  paths: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function localToolName(toolName: string): string {
  return toolName.split('__').at(-1) || toolName
}

function inputPath(input: unknown, field: 'cwd' | 'path'): string | undefined {
  const value = asRecord(input)[field]
  return typeof value === 'string' && value ? value : undefined
}

function memoryPathKind(value: string): MemoryPathKind | undefined {
  const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  const match = /(?:^|\/)\.roxy-agent(?:-dev)?\/memory(?:\/(.*))?$/.exec(normalized)
  if (!match) {
    return undefined
  }

  const relativePath = match[1]
  if (!relativePath) {
    return 'directory'
  }
  if (relativePath === 'MEMORY.md') {
    return 'index'
  }
  if (!relativePath.includes('/') && relativePath.toLowerCase().endsWith('.md')) {
    return 'entry'
  }
  return 'internal'
}

function applyPatchOperations(input: unknown, metadata: MemoryToolMetadata): FileOperation[] {
  const record = asRecord(input)
  const nativeOperation = asRecord(record.operation)
  const nativePath = nativeOperation.path
  const nativeType = nativeOperation.type
  if (typeof nativePath === 'string' && nativePath && typeof nativeType === 'string') {
    return [{
      action: nativeType === 'create_file' ? 'write' : 'update',
      paths: [nativePath],
    }]
  }

  const patch = typeof input === 'string' ? input : typeof record.patch === 'string' ? record.patch : ''
  const operations: FileOperation[] = []
  let currentOperation: FileOperation | undefined
  for (const line of patch.split(/\r?\n/)) {
    const header = /^\*\*\* (Add File|Update File|Delete File): (.+)$/.exec(line)
    if (header) {
      currentOperation = {
        action: header[1] === 'Add File' ? 'write' : 'update',
        paths: [header[2]!.trim()],
      }
      operations.push(currentOperation)
      continue
    }

    const move = /^\*\*\* Move to: (.+)$/.exec(line)
    if (move && currentOperation) {
      currentOperation.paths.push(move[1]!.trim())
    }
  }

  if (operations.length === 0 && metadata.target) {
    operations.push({
      action: metadata.patchType === 'create' ? 'write' : 'update',
      paths: [metadata.target],
    })
  }
  return operations
}

function fileOperations(
  toolName: string,
  input: unknown,
  metadata: MemoryToolMetadata,
): FileOperation[] {
  const name = localToolName(toolName)
  if (name === 'apply_patch') {
    return applyPatchOperations(input, metadata)
  }

  const field = name === 'glob' ? 'cwd' : 'path'
  const target = inputPath(input, field) ?? metadata.target
  if (!target) {
    return []
  }

  if (name === 'read_file' || name === 'grep') {
    return [{ action: 'read', paths: [target] }]
  }
  if (name === 'write_file') {
    return [{ action: 'write', paths: [target] }]
  }
  if (name === 'edit_file') {
    return [{ action: 'update', paths: [target] }]
  }
  if (name === 'ls' || name === 'glob') {
    return [{ action: 'discover', paths: [target] }]
  }
  return []
}

export function getMemoryToolPresentation(
  toolName: string,
  input: unknown,
  metadata: MemoryToolMetadata = {},
): MemoryToolPresentation | undefined {
  const operations = fileOperations(toolName, input, metadata)
  if (operations.length === 0) {
    return undefined
  }

  const classified = operations.map(operation => ({
    operation,
    pathKinds: operation.paths.map(memoryPathKind),
  }))
  if (classified.some(item => item.pathKinds.includes(undefined))) {
    return undefined
  }
  if (classified.some(item => item.operation.action === 'discover')) {
    return { kind: 'hidden' }
  }

  const entryOperations = classified.filter(item => item.pathKinds.includes('entry'))
  if (entryOperations.length === 0) {
    return { kind: 'hidden' }
  }

  const actions = entryOperations.map(item => item.operation.action as MemoryToolAction)
  const action = actions.every(value => value === 'read')
    ? 'read'
    : actions.every(value => value === 'write')
      ? 'write'
      : 'update'
  return {
    kind: 'entries',
    action,
    count: entryOperations.length,
  }
}

export function summarizeMemoryToolEvents(
  events: MemoryToolEventLike[],
): MemoryToolGroupSummary | undefined {
  if (events.length === 0) {
    return undefined
  }

  const presentations = events.map(event => getMemoryToolPresentation(
    event.toolName,
    event.input,
    { patchType: event.patchType, target: event.target },
  ))
  if (presentations.some(presentation => presentation?.kind !== 'entries')) {
    return undefined
  }

  const entries = presentations as Array<Extract<MemoryToolPresentation, { kind: 'entries' }>>
  const action = entries[0]!.action
  if (!entries.every(entry => entry.action === action)) {
    return undefined
  }

  return {
    action,
    count: entries.reduce((total, entry) => total + entry.count, 0),
    completed: events.every(event => event.status === 'success' && event.finished !== false),
  }
}
