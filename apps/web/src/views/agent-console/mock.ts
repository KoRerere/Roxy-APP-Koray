import type { AgentConversation, AgentConsoleState, AgentConversationProcess, AgentMessage, AgentNavItem, AgentTaskGroup } from './types'

export const agentNavItems: AgentNavItem[] = [
  { id: 'new-chat', label: 'New Chat', icon: 'roxy-agent/rx-ic-new-chat', to: { name: 'agent-console-chat' } },
  { id: 'task-manager', label: '任务管理', icon: 'roxy-agent/rx-ic-task-manager', to: { name: 'agent-console-task-manager' } },
]

export const secondaryNavItems: AgentNavItem[] = [
  { id: 'template-store', label: '模板商城', icon: 'roxy-agent/rx-ic-templates-store', to: { name: 'agent-console-template-store' } },
]

export const conversations: AgentConversation[] = [
  { id: 'conv-1', title: 'Search global daily news', updatedAt: '', latestRunId: 'run-1', runningRunIds: [], unread: false },
  { id: 'conv-2', title: 'Facebook account login operation', updatedAt: '', latestRunId: 'run-2', runningRunIds: ['run-2'], unread: false },
  { id: 'conv-3', title: 'Facebook account login operation', updatedAt: '', latestRunId: 'run-3', runningRunIds: [], unread: false },
  { id: 'conv-4', title: 'In usability studies, feedback...', updatedAt: '', runningRunIds: [], unread: false },
  { id: 'conv-5', title: 'Some are classic phrases t...', updatedAt: '', runningRunIds: [], unread: false },
  { id: 'conv-6', title: 'Some are classic phrases t...', updatedAt: '', runningRunIds: [], unread: false },
]

const newsSearchProcess: AgentConversationProcess = {
  id: 'process-news-search',
  durationLabel: '任务耗时40s',
  events: [
    { id: 'thinking-main', type: 'thinking', title: '思考过程', expanded: true, content: '先打开浏览器，再分别交给两个智能体搜索新闻。' },
    { id: 'tool-open-browsers', type: 'tool_call', toolName: 'roxy_open_browsers', status: 'success', input: { count: 2 }, output: '已打开 2 个浏览器' },
    {
      id: 'agent-profile-one', type: 'agent_lifecycle', agentPath: '/root/profile_one', parentAgentPath: '/root', agentName: 'profile_one', agentType: 'browser_worker', lifecycleStatus: 'completed', status: 'success',
      title: '已创建智能体 profile_one', events: [
        { id: 'profile-one-thinking', type: 'thinking', title: '思考过程', content: '读取新闻页面', status: 'success' },
        { id: 'profile-one-tool', type: 'tool_call', toolName: 'browser_snapshot', status: 'success', input: {}, output: '新闻页面快照' },
        { id: 'profile-one-content', type: 'content', emphasis: true, content: '完成新闻搜索：西班牙 1:0 战胜阿根廷。' },
      ], children: [],
    },
    {
      id: 'agent-profile-two', type: 'agent_lifecycle', agentPath: '/root/profile_two', parentAgentPath: '/root', agentName: 'profile_two', agentType: 'browser_worker', lifecycleStatus: 'completed', status: 'success',
      title: '已创建智能体 profile_two', events: [
        { id: 'profile-two-thinking', type: 'thinking', title: '思考过程', content: '读取新闻页面', status: 'success' },
        { id: 'profile-two-tool', type: 'tool_call', toolName: 'browser_snapshot', status: 'success', input: {}, output: '新闻页面快照' },
        { id: 'profile-two-content', type: 'content', emphasis: true, content: '完成新闻搜索：西班牙 1:0 战胜阿根廷。' },
      ], children: [],
    },
    { id: 'final-news-summary', type: 'final_answer', content: '已完成两个浏览器的新闻搜索。' },
  ],
}

export const messagesByConversationId: Record<string, AgentMessage[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      runId: 'run-1',
      role: 'assistant',
      author: 'Roxy AI Agent',
      content: 'Search for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every day',
      createdAt: '2026/07/17 14:24',
      status: 'done',
      process: newsSearchProcess,
    },
  ],
  'conv-2': [
    {
      id: 'msg-3',
      conversationId: 'conv-2',
      role: 'user',
      author: 'You',
      content: 'Open Facebook profiles and verify login state.',
      createdAt: '2026/07/17 14:25',
      status: 'done',
    },
    {
      id: 'msg-4',
      conversationId: 'conv-2',
      runId: 'run-2',
      role: 'assistant',
      author: 'Roxy AI Agent',
      content: 'Checking profiles...',
      createdAt: '14:25',
      status: 'streaming',
    },
  ],
  'conv-3': [],
  'conv-4': [],
  'conv-5': [],
  'conv-6': [],
}

export const taskGroupsByConversationId: Record<string, AgentTaskGroup[]> = {
  'conv-1': [
  {
    id: 'facebook-login-collapsed',
      conversationId: 'conv-1',
    title: 'Facebook account login operation',
    description: '',
    expanded: false,
    tasks: [],
  },
  {
    id: 'facebook-login-active',
      conversationId: 'conv-1',
      runId: 'run-1',
    title: 'Facebook account login operation',
    description: '',
    expanded: true,
    tasks: [
        { id: 'task-1', conversationId: 'conv-1', runId: 'run-1', name: 'MOU-72 · dance_daily', subtitle: 'tiktok.com/@dance_daily', status: 'running' },
        { id: 'task-2', conversationId: 'conv-1', runId: 'run-1', name: 'MOU-72 · dance_daily', subtitle: 'instagram.com/food_hunter', status: 'queued' },
    ],
  },
  {
    id: 'facebook-login-review',
      conversationId: 'conv-1',
    title: 'Facebook account login operation',
    description: '',
    expanded: false,
    tasks: [],
  },
  {
    id: 'facebook-login-pending',
      conversationId: 'conv-1',
    title: 'Facebook account login operation',
    description: '',
    expanded: false,
    tasks: [],
  },
  ],
  'conv-2': [
    {
      id: 'facebook-login-active-conv-2',
      conversationId: 'conv-2',
      runId: 'run-2',
      title: 'Facebook account login operation',
      description: '',
      expanded: true,
      tasks: [
        { id: 'task-4', conversationId: 'conv-2', runId: 'run-2', name: 'MOU-89 · store_admin', subtitle: 'facebook.com/store_admin', status: 'running' },
        { id: 'task-5', conversationId: 'conv-2', runId: 'run-2', name: 'MOU-90 · page_ops', subtitle: 'facebook.com/page_ops', status: 'queued' },
      ],
    },
  ],
  'conv-3': [],
  'conv-4': [],
  'conv-5': [],
  'conv-6': [],
}

export function createInitialAgentConsoleState(): AgentConsoleState {
  const conversationIds = conversations.map(conversation => conversation.id)
  const conversationsById = Object.fromEntries(conversations.map(conversation => [conversation.id, { ...conversation }]))

  return {
    conversationIds,
    conversationsById,
    draftsByConversationId: Object.fromEntries(conversationIds.map(conversationId => [conversationId, { conversationId, prompt: '', attachments: [] }])),
    queuedPromptsByConversationId: Object.fromEntries(conversationIds.map(conversationId => [conversationId, []])),
    messagesByConversationId: Object.fromEntries(conversationIds.map(conversationId => [
      conversationId,
      (messagesByConversationId[conversationId] ?? []).map(message => ({ ...message })),
    ])),
    runsById: {
      'run-1': { id: 'run-1', conversationId: 'conv-1', status: 'completed', startedAt: '2026/07/17 14:24', completedAt: '2026/07/17 14:24' },
      'run-2': { id: 'run-2', conversationId: 'conv-2', status: 'streaming', startedAt: '2026/07/17 14:25' },
      'run-3': { id: 'run-3', conversationId: 'conv-3', status: 'completed', startedAt: '2026/07/17 14:26', completedAt: '2026/07/17 14:27' },
    },
    streamsByRunId: {
      'run-1': { id: 'stream-1', conversationId: 'conv-1', runId: 'run-1', status: 'completed', events: [], lastSequence: 0 },
      'run-2': { id: 'stream-2', conversationId: 'conv-2', runId: 'run-2', status: 'streaming', events: [], lastSequence: 0 },
    },
    todoProgressByRunId: {},
    pendingHitlByConversationId: {},
    taskGroupsByConversationId: Object.fromEntries(conversationIds.map(conversationId => [
      conversationId,
      (taskGroupsByConversationId[conversationId] ?? []).map(group => ({
        ...group,
        tasks: group.tasks.map(task => ({ ...task })),
      })),
    ])),
  }
}
