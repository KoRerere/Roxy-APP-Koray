import { describe, expect, it } from 'vitest'
import { buildTaskReportMarkdown, taskReportFileName } from './task-report-export'

describe('buildTaskReportMarkdown', () => {
  it('exports a readable localized Markdown report', () => {
    const markdown = buildTaskReportMarkdown(
      {
        taskName: '评论,分析',
        params: [
          { key: 'query', name: '关键词', value: 'a | quoted\nvalue' },
          { key: 'limit', name: '数量', value: 2 },
        ],
        windows: [
          { dirId: 'dir-1', success: true, failureReason: '' },
          { dirId: 'dir-2', success: false, failureReason: '页面|加载失败' },
        ],
      },
      [
        { window: 'A-1', country: 'US', account: 'user@example.com', result: '成功', failureReason: '' },
        { window: 'A-2', country: 'CN', account: '账号', result: '失败', failureReason: '页面|加载失败' },
      ],
      {
        total: '2',
        used: '2',
        succeeded: '1',
        unused: '0',
        successRate: '50%',
      },
      {
        title: '执行报告',
        taskName: '任务名称',
        reportStatus: '报告状态',
        completed: '已完成',
        parameters: '任务参数',
        noParameters: '无参数',
        parameterKey: '参数键',
        parameterName: '参数名称',
        parameterValue: '参数值',
        windows: '执行窗口',
        window: '窗口',
        country: '地区',
        account: '账号',
        result: '结果',
        failureReason: '失败原因',
        summary: '汇总',
        total: '总数',
        used: '使用数',
        succeeded: '成功数',
        unused: '未使用数',
        successRate: '成功率',
      },
    )

    expect(markdown).toContain('# 执行报告')
    expect(markdown).toContain('## 任务名称')
    expect(markdown).toContain('评论,分析')
    expect(markdown).toContain('| 关键词 | query | a \\| quoted<br>value |')
    expect(markdown).toContain('| A-2 | CN | 账号 | 失败 | 页面\\|加载失败 |')
    expect(markdown).toContain('| 已完成 |')
    expect(markdown).toContain('| 2 | 2 | 1 | 0 | 50% |')
  })

  it('renders empty values as dashes and escapes table separators', () => {
    const markdown = buildTaskReportMarkdown(
      {
        taskName: '任务',
        params: [],
        windows: [
          { dirId: 'dir-1', success: false, failureReason: '' },
        ],
      },
      [
        { window: '窗口|1', country: 'CN', account: '', result: '失败', failureReason: '' },
      ],
      {
        total: '1',
        succeeded: '0',
        successRate: '0%',
      },
      {
        title: '执行报告',
        taskName: '任务名称',
        reportStatus: '报告状态',
        completed: '已完成',
        parameters: '任务参数',
        noParameters: '无参数',
        parameterKey: '参数键',
        parameterName: '参数名称',
        parameterValue: '参数值',
        windows: '执行窗口',
        window: '窗口',
        country: '地区',
        account: '账号',
        result: '结果',
        failureReason: '失败原因',
        summary: '汇总',
        total: '总数',
        succeeded: '成功数',
        successRate: '成功率',
      },
    )

    expect(markdown).toContain('| 无参数 | - | - |')
    expect(markdown).toContain('| 窗口\\|1 | CN | - | 失败 | - |')
  })
})

describe('taskReportFileName', () => {
  it('removes unsafe filename characters and falls back for empty titles', () => {
    expect(taskReportFileName('任务 / 2026:09')).toBe('任务___2026_09.md')
    expect(taskReportFileName('   ')).toBe('task-report.md')
  })
})
