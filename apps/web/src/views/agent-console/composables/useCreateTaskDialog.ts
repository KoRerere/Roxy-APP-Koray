import type { UserTaskCreate } from '@roxy/agent-api'
import type { MyTemplateKind } from '../my-templates'
import type { TaskDialogPayload, UserTaskDTO } from '../task-manager'
import { useDialog } from 'primevue/usedialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useAgentConsoleApi } from '../api'
import CreateTaskDialog from '../components/dialog/CreateTaskDialog.vue'
import {
  buildTaskMetadata,
  readTaskMutation,
  toUserTaskCreatePlanType,
} from '../task-manager'
import { fetchTaskWindowOptionsPage } from '../task-window-options'

export interface TaskCreationTemplate {
  id: number
  kind?: MyTemplateKind
  name: string
}

interface OpenTaskCreationOptions {
  onCreated?: (task: UserTaskDTO) => void | Promise<void>
}

export function useCreateTaskDialog() {
  const dialog = useDialog()
  const workspaceStore = useWorkspaceStore()
  const agentApi = useAgentConsoleApi()
  const [showToast, onlyErrorToast] = useResponseToast()

  async function saveTask(payload: TaskDialogPayload, options: OpenTaskCreationOptions) {
    try {
      const body: UserTaskCreate = {
        name: payload.name,
        user_template_id: payload.userTemplateId,
        window_ids: payload.windowIds,
        plan_type: toUserTaskCreatePlanType(payload.planType),
        cron: payload.cron,
        timezone: payload.timezone,
        execute_at: payload.executeAt,
        enabled: payload.enabled,
        metadata: buildTaskMetadata(payload.concurrency),
      }
      const response = await agentApi.userTasks.createUserTask(body)
      const task = readTaskMutation<UserTaskDTO>(response, $t('创建任务失败'))
      showToast(0, $t('任务已创建'))
      try {
        await agentApi.syncTasks()
      }
      catch (error) {
        console.warn('Failed to sync local task scheduler', error)
        onlyErrorToast(-1, $t('任务已保存，本地计划同步失败，将自动重试'))
      }
      await options.onCreated?.(task)
      return true
    }
    catch (error) {
      console.error('Failed to create user task', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('创建任务失败'))
      return false
    }
  }

  async function openCreateTaskDialog(template: TaskCreationTemplate, options: OpenTaskCreationOptions = {}) {
    try {
      const workspaceName = workspaceStore.currentWorkspace?.workspaceName
      dialog.open(CreateTaskDialog, {
        props: {
          modal: true,
          blockScroll: true,
          dismissableMask: false,
          draggable: false,
          showHeader: false,
          style: { width: 'min(440px, calc(100vw - 32px))' },
          pt: {
            root: 'agent-console-dialog agent-console-create-task-dialog',
            content: '!p-0 !overflow-hidden',
          },
        },
        data: {
          initialValues: {
            name: template.name,
            userTemplateId: template.id,
            windowIds: [],
            planType: 'manual',
            cron: null,
            timezone: null,
            executeAt: null,
            enabled: true,
            concurrency: template.kind === 'script' ? undefined : null,
          },
          templateOptions: [{
            kind: template.kind,
            label: template.name,
            value: template.id,
          }],
          windowOptions: [],
          loadWindowOptions: (pageIndex: number, keyword: string, projectId: string) => fetchTaskWindowOptionsPage({
            pageIndex,
            pageSize: 10,
            keyword,
            projectId,
          }, workspaceName),
          lockTemplate: true,
          onSave: (payload: TaskDialogPayload) => saveTask(payload, options),
        },
      })
      return true
    }
    catch (error) {
      console.error('Failed to prepare task dialog', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('加载任务创建信息失败'))
      return false
    }
  }

  return { openCreateTaskDialog }
}
