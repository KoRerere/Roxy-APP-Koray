export interface OpenAPIWorkspace {
  id?: string | number
  userId?: number
  workspaceName?: string
  project_details?: Array<{
    projectId: number
    projectName: string
  }>
}

export interface OpenAPIConfig {
  apiKey: string
  port: number
  open: boolean
  apiRate: number
}

interface BackendResult<T> {
  code: number
  data: T
  msg: string
}

interface WorkspaceCredentialsDependencies {
  listWorkspaces: (apiKey: string) => Promise<BackendResult<{
    total: number
    rows: OpenAPIWorkspace[]
  }>>
  getWorkspaceApiKey: (workspaceId: string | number) => Promise<BackendResult<OpenAPIConfig>>
}

export function createWorkspaceCredentialsService(dependencies: WorkspaceCredentialsDependencies) {
  async function listAccessibleWorkspaces(apiKey: string) {
    const result = await dependencies.listWorkspaces(apiKey)
    if (result.code !== 0) {
      throw new Error(result.msg)
    }
    return result.data?.rows ?? []
  }

  async function hasWorkspace(apiKey: string, workspaceId: string | number) {
    const workspaces = await listAccessibleWorkspaces(apiKey)
    return workspaces.some(item => String(item.id) === String(workspaceId))
  }

  async function select(apiKey: string, workspaceId: string | number) {
    const workspaces = await listAccessibleWorkspaces(apiKey)
    const workspace = workspaces.find(item => String(item.id) === String(workspaceId))
    if (!workspace) {
      throw new Error('workspace not found or inaccessible')
    }

    // 目标 APIKey 是切换权限和目标 OpenAPI 配置的权威来源。
    const result = await dependencies.getWorkspaceApiKey(workspaceId)
    if (result.code !== 0) {
      throw new Error(result.msg)
    }
    if (!result.data?.apiKey) {
      throw new Error('workspace API key is unavailable')
    }

    return {
      workspace: sanitizeWorkspace(workspace),
      ...result.data,
    }
  }

  async function getActive(apiKey: string) {
    const workspaces = await listAccessibleWorkspaces(apiKey)
    for (const workspace of workspaces) {
      if (workspace.id === undefined) {
        continue
      }
      const result = await dependencies.getWorkspaceApiKey(workspace.id)
      if (result.code === 0 && result.data?.apiKey === apiKey) {
        return {
          ...sanitizeWorkspace(workspace),
          // APIKey 不对外返回，但当前空间的服务端口是调用方建立连接所必需的。
          port: result.data.port,
        }
      }
    }
    throw new Error('active workspace not found')
  }

  return { hasWorkspace, select, getActive }
}

function sanitizeWorkspace(workspace: OpenAPIWorkspace) {
  const { userId: _userId, ...result } = workspace
  return result
}
