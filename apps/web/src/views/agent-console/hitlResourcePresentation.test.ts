import { beforeEach, describe, expect, it, vi } from 'vitest'

const backendApi = vi.hoisted(() => ({
  platform: {
    userGetPlatformInfoV2List: vi.fn(),
  },
  proxy: {
    userGetProxyModuleList: vi.fn(),
  },
  window: {
    userGetWindowInfoV2List: vi.fn(),
  },
}))

vi.hoisted(() => {
  vi.stubGlobal('$t', (message: string, values?: Record<string, unknown>) =>
    message.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? `{${key}}`)))
})

vi.mock('/@/api', () => ({ API: backendApi }))

const { resolveHitlActionTitles } = await import('./hitlResourcePresentation')

function createAgentApis() {
  return {
    officialScripts: {
      getOfficialScript: vi.fn(),
    },
    templates: {
      getOfficialTemplate: vi.fn(),
    },
    userTemplates: {
      getUserTemplate: vi.fn(),
    },
  }
}

describe('hitl resource presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses window numbers in the requested order for profile deletion', async () => {
    backendApi.window.userGetWindowInfoV2List.mockResolvedValue({
      code: 0,
      data: {
        rows: [
          { dirId: 'window-2', windowSortNum: 45 },
          { dirId: 'window-1', windowSortNum: 120 },
        ],
      },
    })

    const titles = await resolveHitlActionTitles([
      {
        name: 'mcp_roxybrowser-openapi-mcp__roxy_profile_delete',
        args: { dirIds: ['window-1', 'window-2'] },
      },
    ], {
      ...createAgentApis(),
      locale: 'zh-CN',
      workspaceName: 'anbin',
    })

    expect(titles).toEqual(['删除窗口 ANB-120、ANB-45'])
    expect(backendApi.window.userGetWindowInfoV2List).toHaveBeenCalledWith({
      page_index: 1,
      page_size: 2,
      dirIds: 'window-1,window-2',
      isDelete: 0,
    })
  })

  it('uses proxy remarks and falls back only unresolved ids', async () => {
    backendApi.proxy.userGetProxyModuleList.mockResolvedValue({
      code: 0,
      data: {
        rows: [{ id: 8, remark: '美国住宅' }],
      },
    })

    const titles = await resolveHitlActionTitles([
      {
        name: 'roxy_proxy_delete',
        args: { ids: [8, 9] },
      },
    ], {
      ...createAgentApis(),
      locale: 'zh-CN',
      workspaceName: 'anbin',
    })

    expect(titles).toEqual(['删除代理 IP 美国住宅、9'])
  })

  it('uses platform usernames and preserves successful lookups when one request fails', async () => {
    backendApi.platform.userGetPlatformInfoV2List
      .mockResolvedValueOnce({
        code: 0,
        data: { rows: [{ id: 12, platformUserName: 'shop-owner' }] },
      })
      .mockRejectedValueOnce(new Error('network unavailable'))

    const titles = await resolveHitlActionTitles([
      {
        name: 'roxy_platform_account_delete',
        args: { ids: [12, 13] },
      },
    ], {
      ...createAgentApis(),
      locale: 'zh-CN',
      workspaceName: 'anbin',
    })

    expect(titles).toEqual(['删除平台账号 shop-owner、13'])
  })

  it('resolves all supported script references and includes target window numbers', async () => {
    const agentApis = createAgentApis()
    backendApi.window.userGetWindowInfoV2List.mockResolvedValue({
      code: 0,
      data: { rows: [{ dirId: 'window-1', windowSortNum: 120 }] },
    })
    agentApis.templates.getOfficialTemplate.mockResolvedValue({
      data: { name: { zh: '商品采集', en: 'Product collector' } },
    })
    agentApis.userTemplates.getUserTemplate.mockResolvedValue({
      data: { name: '私有脚本' },
    })
    agentApis.officialScripts.getOfficialScript.mockResolvedValue({
      data: { name: { zh: '旧版脚本', en: 'Legacy script' } },
    })

    const titles = await resolveHitlActionTitles([
      { name: 'roxy_script_run', args: { scriptPath: 'official:42', dirIds: ['window-1'] } },
      { name: 'roxy_script_run', args: { scriptPath: 'user:7', dirIds: ['window-1'] } },
      { name: 'roxy_script_run', args: { scriptPath: 'legacy-script', dirIds: ['window-1'] } },
      { name: 'roxy_script_run', args: { scriptPath: '/tmp/collector.ts', dirIds: ['window-1'] } },
    ], {
      ...agentApis,
      locale: 'zh-CN',
      workspaceName: 'anbin',
    })

    expect(titles).toEqual([
      '在窗口 ANB-120 中运行脚本 商品采集',
      '在窗口 ANB-120 中运行脚本 私有脚本',
      '在窗口 ANB-120 中运行脚本 旧版脚本',
      '在窗口 ANB-120 中运行脚本 collector.ts',
    ])
    expect(agentApis.templates.getOfficialTemplate).toHaveBeenCalledWith({ templateIdOrSlug: '42' })
    expect(agentApis.userTemplates.getUserTemplate).toHaveBeenCalledWith({ templateId: 7 })
    expect(agentApis.officialScripts.getOfficialScript).toHaveBeenCalledWith({ scriptIdOrSlug: 'legacy-script' })
  })

  it('does not query malformed canonical script references', async () => {
    const agentApis = createAgentApis()

    const titles = await resolveHitlActionTitles([
      { name: 'roxy_script_run', args: { scriptPath: 'official:042' } },
      { name: 'roxy_script_run', args: { scriptPath: 'user:0' } },
    ], {
      ...agentApis,
      locale: 'zh-CN',
      workspaceName: 'anbin',
    })

    expect(titles).toEqual(['运行脚本 official:042', '运行脚本 user:0'])
    expect(agentApis.templates.getOfficialTemplate).not.toHaveBeenCalled()
    expect(agentApis.userTemplates.getUserTemplate).not.toHaveBeenCalled()
    expect(agentApis.officialScripts.getOfficialScript).not.toHaveBeenCalled()
  })

  it('does not add presentations for core agent tools', async () => {
    const titles = await resolveHitlActionTitles([
      { name: 'spawn_agent', args: { task_name: 'worker' } },
      { name: 'apply_patch', args: '*** Begin Patch\n*** End Patch' },
      { name: 'exec_command', args: { cmd: 'pnpm test' } },
    ], {
      ...createAgentApis(),
      locale: 'zh-CN',
      workspaceName: 'anbin',
    })

    expect(titles).toEqual([undefined, undefined, undefined])
    expect(backendApi.window.userGetWindowInfoV2List).not.toHaveBeenCalled()
  })
})
