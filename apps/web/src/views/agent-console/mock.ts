import type { AgentConversation, AgentConsoleState, AgentConversationProcess, AgentMessage, AgentNavItem, AgentTaskGroup } from './types'

export const agentNavItems: AgentNavItem[] = [
  { id: 'new-chat', label: 'New Chat', icon: 'roxy-agent/rx-ic-new-chat', to: { name: 'agent-console-chat' } },
  { id: 'task-manager', label: '任务管理', icon: 'roxy-agent/rx-ic-task-manager', to: { name: 'agent-console-task-manager' } },
]

export const secondaryNavItems: AgentNavItem[] = [
  { id: 'template-store', label: '模板商城', icon: 'roxy-agent/rx-ic-templates-store', to: { name: 'agent-console-template-store' } },
]

export const conversations: AgentConversation[] = [
  { id: 'conv-1', title: 'Search global daily news', updatedAt: '', latestRunId: 'run-1', runningRunIds: [] },
  { id: 'conv-2', title: 'Facebook account login operation', updatedAt: '', latestRunId: 'run-2', runningRunIds: ['run-2'] },
  { id: 'conv-3', title: 'Facebook account login operation', updatedAt: '', latestRunId: 'run-3', runningRunIds: [] },
  { id: 'conv-4', title: 'In usability studies, feedback...', updatedAt: '', runningRunIds: [] },
  { id: 'conv-5', title: 'Some are classic phrases t...', updatedAt: '', runningRunIds: [] },
  { id: 'conv-6', title: 'Some are classic phrases t...', updatedAt: '', runningRunIds: [] },
]

const newsSearchProcess: AgentConversationProcess = {
  id: 'process-news-search',
  durationLabel: '任务耗时40s',
  events: [
    {
      id: 'thinking-main',
      type: 'thinking',
      title: '思考过程',
      expanded: true,
      content: '用户想要：\n1. 打开两个浏览器（刚才创建的两个：`548e30cf0cada4585661c68b6d222428`和`1982d0a0385d3c030451e47c25092b3c`）2. 在它们里面搜索新闻首先我需要打开这两个浏览器，获取 CDP endpoints，然后用 parallel_dispatch 同时让两个 worker 去搜索新闻。让我先打开两个浏览器。',
    },
    {
      id: 'content-open-browsers',
      type: 'content',
      content: '先打开两个浏览器获取连接端点，再并行搜索新闻。',
    },
    {
      id: 'tool-open-browsers',
      type: 'tool_call',
      toolName: 'roxy_open_browsers',
      status: 'success',
    },
    {
      id: 'parallel-search-news',
      type: 'parallel_dispatch',
      title: '创建 2 个并行任务',
      count: 2,
      expanded: true,
      tasks: [
        {
          id: 'worker-browser-1',
          type: 'worker_task',
          title: '执行任务在浏览器1中搜索新闻',
          expanded: true,
          status: 'success',
          events: [
            {
              id: 'worker-browser-1-thinking',
              type: 'thinking',
              title: '思考过程',
              expanded: true,
              content: '用户想要：\n1. 打开两个浏览器（刚才创建的两个：`548e30cf0cada4585661c68b6d222428`和`1982d0a0385d3c030451e47c25092b3c`）2. 在它们里面搜索新闻首先我需要打开这两个浏览器，获取 CDP endpoints，然后用 parallel_dispatch 同时让两个 worker 去搜索新闻。让我先打开两个浏览器。',
            },
            {
              id: 'worker-browser-1-skill',
              type: 'skill_load',
              skillPath: 'roxybrowser-playwright-skills/SKILL.md',
              status: 'success',
            },
            {
              id: 'worker-browser-1-content',
              type: 'content',
              emphasis: true,
              content: '2026美加墨世界杯决赛：西班牙1:0战胜阿根廷，队史第二次夺冠',
            },
          ],
        },
        {
          id: 'worker-browser-2',
          type: 'worker_task',
          title: '执行任务在浏览器2中搜索新闻',
          expanded: true,
          status: 'success',
          events: [
            {
              id: 'worker-browser-2-thinking',
              type: 'thinking',
              title: '思考过程',
              expanded: true,
              content: '用户想要：\n1. 打开两个浏览器（刚才创建的两个：`548e30cf0cada4585661c68b6d222428`和`1982d0a0385d3c030451e47c25092b3c`）2. 在它们里面搜索新闻首先我需要打开这两个浏览器，获取 CDP endpoints，然后用 parallel_dispatch 同时让两个 worker 去搜索新闻。让我先打开两个浏览器。',
            },
            {
              id: 'worker-browser-2-skill',
              type: 'skill_load',
              skillPath: 'roxybrowser-playwright-skills/SKILL.md',
              status: 'success',
            },
            {
              id: 'worker-browser-2-content',
              type: 'content',
              emphasis: true,
              content: '2026美加墨世界杯决赛：西班牙1:0战胜阿根廷，队史第二次夺冠',
            },
          ],
        },
      ],
    },
    {
      id: 'final-news-summary',
      type: 'final_answer',
      content: 'Search for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every daySearch for the latest political, financial and technological news from around the world every day',
    },
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
    taskGroupsByConversationId: Object.fromEntries(conversationIds.map(conversationId => [
      conversationId,
      (taskGroupsByConversationId[conversationId] ?? []).map(group => ({
        ...group,
        tasks: group.tasks.map(task => ({ ...task })),
      })),
    ])),
  }
}
