import type { RuntimeFileCollector } from '../file-collector'
import type {
  ApplyPatchInput,
  PathPermissions,
  ToolMiddleware,
  ToolMiddlewareContext,
} from 'roxy-agent-runtime'
import path from 'node:path'
import { applyPatchInputSchema, normalizeApplyPatchInput } from 'roxy-agent-runtime'

const FILE_TOOLS = /^(read_file|write_file|edit_file|apply_patch|ls|glob|grep)$/

export interface RuntimeFilesystemMiddlewareOptions {
  workspaceDir: string
  displayRoot?: string
  additionalWriteRoots?: string[]
  ignoredArtifactRoots?: string[]
  workerId?: string
  agentPath?: string
  permissions?: PathPermissions
  collector: RuntimeFileCollector
}

interface PendingArtifact {
  virtualPath: string
  realPath: string
  op: 'write' | 'edit'
}

function isInside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate)
  return relativePath === ''
    || (
      relativePath !== '..'
      && !relativePath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativePath)
    )
}

/** Resolve builtin filesystem operations inside the agent workspace. */
export function createRuntimeFilesystemMiddleware(
  options: RuntimeFilesystemMiddlewareOptions,
): ToolMiddleware {
  const workspaceDir = path.resolve(options.workspaceDir)
  const displayRoot = path.resolve(options.displayRoot ?? workspaceDir)
  const writeRoots = [workspaceDir, ...(options.additionalWriteRoots ?? []).map(root => path.resolve(root))]
  const ignoredArtifactRoots = (options.ignoredArtifactRoots ?? []).map(root => path.resolve(root))
  const pendingArtifacts = new Map<string, PendingArtifact[]>()

  function shouldCollectArtifact(realPath: string): boolean {
    return !ignoredArtifactRoots.some(root => isInside(root, realPath))
  }

  function checkPath(supplied: string, toolName: string): string {
    const realPath
      = toolName === 'apply_patch' ? path.resolve(supplied) : path.resolve(workspaceDir, supplied)
    if (toolName === 'write_file' || toolName === 'edit_file') {
      if (!writeRoots.some(root => isInside(root, realPath))) {
        throw new Error(`${toolName}: path not allowed: ${supplied}`)
      }
    }
    if (options.permissions && options.permissions.checkPath(realPath) !== 'allow') {
      throw new Error(`${toolName}: path not allowed: ${supplied}`)
    }
    return realPath
  }

  function patchArtifacts(input: ApplyPatchInput, ctx: ToolMiddlewareContext): PendingArtifact[] {
    const artifacts: PendingArtifact[] = []
    for (const operation of normalizeApplyPatchInput(input)) {
      const realPath = checkPath(operation.path, ctx.toolName)
      if (operation.type === 'add' && shouldCollectArtifact(realPath)) {
        artifacts.push({
          virtualPath: path.relative(displayRoot, realPath),
          realPath,
          op: 'write',
        })
      }
      else if (operation.type === 'update') {
        const targetPath = operation.moveTo ? checkPath(operation.moveTo, ctx.toolName) : realPath
        if (shouldCollectArtifact(targetPath)) {
          artifacts.push({
            virtualPath: path.relative(displayRoot, targetPath),
            realPath: targetPath,
            op: 'edit',
          })
        }
      }
    }
    return artifacts
  }

  function normalizeInput(input: unknown, ctx: ToolMiddlewareContext, stageArtifact: boolean) {
    if (ctx.toolName === 'apply_patch') {
      const parsed = applyPatchInputSchema.parse(input)
      const artifacts = patchArtifacts(parsed, ctx)
      if (stageArtifact) {
        pendingArtifacts.set(ctx.toolUseId, artifacts)
      }
      return parsed
    }

    const raw
      = input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {}
    const field = ctx.toolName === 'glob' ? 'cwd' : 'path'
    const supplied = raw[field]
    if (field === 'path' && (typeof supplied !== 'string' || supplied.length === 0)) {
      return input
    }
    if (
      field === 'cwd'
      && supplied !== undefined
      && (typeof supplied !== 'string' || supplied.length === 0)
    ) {
      return input
    }

    const virtualPath = typeof supplied === 'string' && supplied.length > 0 ? supplied : '.'
    const resolved = checkPath(virtualPath, ctx.toolName)
    if (
      stageArtifact
      && (ctx.toolName === 'write_file' || ctx.toolName === 'edit_file')
      && typeof supplied === 'string'
      && shouldCollectArtifact(resolved)
    ) {
      pendingArtifacts.set(ctx.toolUseId, [
        {
          virtualPath,
          realPath: resolved,
          op: ctx.toolName === 'write_file' ? 'write' : 'edit',
        },
      ])
    }
    return { ...raw, [field]: resolved }
  }

  return {
    match: FILE_TOOLS,
    preview: (input, ctx) => normalizeInput(input, ctx, false),
    before: (input, ctx) => normalizeInput(input, ctx, true),
    after(result, ctx) {
      const artifacts = pendingArtifacts.get(ctx.toolUseId) ?? []
      pendingArtifacts.delete(ctx.toolUseId)
      if (!result.isError) {
        for (const artifact of artifacts) {
          options.collector.record({
            ...artifact,
            displayName: path.basename(artifact.realPath),
            source:
              ctx.toolName === 'apply_patch'
                ? 'apply_patch'
                : artifact.op === 'write'
                  ? 'write_file'
                  : 'edit_file',
            toolName: ctx.toolName,
            toolUseId: ctx.toolUseId,
            workerId: options.workerId,
            agentPath: options.agentPath,
          })
        }
      }
      return result
    },
  }
}
