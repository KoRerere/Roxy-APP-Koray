import type { Ref } from 'vue'
import type { RunnableUserTemplate } from '../template-task-execution'
import type { UserTaskDTO } from '../task-manager'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useAgentConsoleApi } from '../api'
import { readUserTaskPage } from '../task-manager'
import {
  getAgentSkillInstalledRoot,
  setAgentSkillInstalledRoot,
} from '../components/chat-composer/templateItems'
import {
  buildTemplateTaskComposerPrompt,
  getRunnableTemplateKind,
} from '../template-task-execution'

const PAGE_SIZE = 200

export function useTemplateTaskExecution(prompt: Ref<string>) {
  const agentApi = useAgentConsoleApi()
  const route = useRoute()
  const router = useRouter()
  const [showToast, onlyErrorToast] = useResponseToast()

  async function findTaskByUserTemplateId(userTemplateId: number): Promise<UserTaskDTO | undefined> {
    let offset = 0
    let expectedTotal = 0

    do {
      const response = await agentApi.userTasks.listUserTasks({
        limit: PAGE_SIZE,
        offset,
        sortBy: 'created_at',
        sortOrder: 'desc',
      })
      const page = readUserTaskPage(response, $t('加载任务失败'))
      const task = page.items.find(item => item.userTemplateId === userTemplateId)
      if (task)
        return task

      expectedTotal = page.total
      offset += page.items.length
      if (!page.items.length)
        break
    } while (offset < expectedTotal)

    return undefined
  }

  async function executeTemplateTask(
    task: UserTaskDTO,
    template: RunnableUserTemplate,
  ): Promise<boolean> {
    try {
      const kind = getRunnableTemplateKind(template)
      if (!kind)
        throw new Error($t('任务模板类型不受支持'))

      if (kind === 'script') {
        await agentApi.runTask(task.id)
        showToast(0, $t('任务已开始'))
        await router.push({ name: 'agent-console-task-manager', query: route.query })
        return true
      }

      if (kind === 'skill' && !getAgentSkillInstalledRoot()) {
        try {
          const info = await agentApi.skillPathInfo()
          setAgentSkillInstalledRoot(info.installedRoot)
        }
        catch (error) {
          console.error('Failed to load Skill installed root', error)
        }
      }

      const composerPrompt = buildTemplateTaskComposerPrompt(template, task)
      if (!composerPrompt)
        throw new Error($t('任务提示词为空'))
      prompt.value = composerPrompt
      await router.push({ name: 'agent-console-chat', query: route.query })
      return true
    }
    catch (error) {
      console.error('Failed to execute template task', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('启动任务失败'))
      return false
    }
  }

  return {
    executeTemplateTask,
    findTaskByUserTemplateId,
  }
}
