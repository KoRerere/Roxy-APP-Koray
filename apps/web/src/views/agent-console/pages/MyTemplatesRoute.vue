<script setup lang="ts">
import type { CustomTemplatePayload, MyTemplateItem, UserTemplateDTO } from '../my-templates'
import AgentConsolePageLayout from '../components/AgentConsolePageLayout.vue'
import MyTemplateCard from '../components/MyTemplateCard.vue'
import MyTemplateCardSkeleton from '../components/skeleton/MyTemplateCardSkeleton.vue'
import CreateTemplateDialog from '../components/dialog/CreateTemplateDialog.vue'
import { useCreateTaskDialog } from '../composables/useCreateTaskDialog'
import { useCustomTemplateDialog } from '../composables/useCustomTemplateDialog'
import { useTemplateTaskExecution } from '../composables/useTemplateTaskExecution'
import {
  buildCustomTemplateRequest,
  buildCustomTemplateUpdate,
  mapMyTemplateItem,
  readUserTemplateMutation,
  readUserTemplatePage,
  readUserTemplateVoidMutation,
} from '../my-templates'
import { useAgentConsoleApi } from '../api'
import { isTemplateUnread, markTemplateRead, markTemplateUnread, readUnreadTemplateKeys } from '../template-unread'
import { deleteMyTemplate } from '../my-template-deletion'
import {
  getAgentSkillInstalledRoot,
  setAgentSkillInstalledRoot,
  userTemplateToChatPrompt,
} from '../components/chat-composer/templateItems'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import {
  announceNewTemplateCreated,
  getAgentConsoleAccountId,
  markNewTemplateGuidePending,
} from '../template-guide'

const PAGE_SIZE = 200

const prompt = defineModel<string>('prompt', { required: true })

const agentApi = useAgentConsoleApi()
const userStore = useUserStore()
const dialog = useDialog()
const confirm = useConfirm()
const route = useRoute()
const router = useRouter()
const [showToast, onlyErrorToast] = useResponseToast()
const { openCreateTaskDialog } = useCreateTaskDialog()
const { openCustomTemplateDialog } = useCustomTemplateDialog()
const { executeTemplateTask } = useTemplateTaskExecution(prompt)
const templates = ref<MyTemplateItem[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref(false)
const creatingTaskId = ref<number>()
const openingTemplateId = ref<number>()
const deletingTemplateIds = ref(new Set<number>())
const unreadTemplateKeys = ref(readUnreadTemplateKeys())
let requestSequence = 0

function markTemplateAsUnread(template: UserTemplateDTO) {
  unreadTemplateKeys.value = markTemplateUnread(template)
}

function markTemplateAsRead(template: MyTemplateItem | UserTemplateDTO) {
  unreadTemplateKeys.value = markTemplateRead(template)
}

function templateIsUnread(template: MyTemplateItem) {
  return isTemplateUnread(unreadTemplateKeys.value, template)
}

async function openTaskAndRun(template: UserTemplateDTO) {
  await openCreateTaskDialog({
    id: template.id,
    kind: normalizeTemplateKind(template.templateType),
    name: template.name,
  }, {
    onCreated: task => executeTemplateTask(task, template),
  })
}

function mapTemplates(rows: UserTemplateDTO[]) {
  return rows
    .map(mapMyTemplateItem)
    .filter((item): item is MyTemplateItem => Boolean(item))
}

async function createTemplate(payload: CustomTemplatePayload) {
  try {
    const response = await agentApi.userTemplates.createUserTemplate(
      buildCustomTemplateRequest(payload),
    )
    const created = readUserTemplateMutation(response, $t('创建模板失败'))
    markTemplateAsUnread(created)
    const accountId = getAgentConsoleAccountId(userStore.userInfo)
    if (accountId) {
      markNewTemplateGuidePending(accountId)
      announceNewTemplateCreated()
    }
    showToast(0, $t('模板已创建'))
    await fetchAllTemplates()

    if (payload.saveAndRun) {
      window.setTimeout(() => {
        void openTaskAndRun(created)
      })
    }

    return Boolean(created.id)
  }
  catch (error) {
    console.error('Failed to create user template', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('创建模板失败'))
    return false
  }
}

function normalizeTemplateKind(value: string): MyTemplateItem['kind'] {
  return value === 'script' || value === 'skill' ? value : 'prompt'
}

async function updateTemplate(item: MyTemplateItem, payload: CustomTemplatePayload) {
  try {
    const response = await agentApi.userTemplates.updateUserTemplate(
      { templateId: item.id },
      buildCustomTemplateUpdate(payload),
    )
    const updated = readUserTemplateMutation(response, $t('更新模板失败'))
    showToast(0, $t('模板已更新'))
    await fetchAllTemplates()

    if (payload.saveAndRun) {
      window.setTimeout(() => {
        void openTaskAndRun(updated)
      })
    }
    return true
  }
  catch (error) {
    console.error('Failed to update user template', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('更新模板失败'))
    return false
  }
}

function showTemplateDialog(template?: MyTemplateItem, options?: { loadDetail?: boolean }) {
  dialog.open(CreateTemplateDialog, {
    props: {
      modal: true,
      blockScroll: true,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(540px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-create-template-dialog',
        content: '!p-0 !overflow-hidden',
      },
    },
    data: {
      template,
      loadDetail: options?.loadDetail,
      onSave: template
        ? (payload: CustomTemplatePayload) => updateTemplate(template, payload)
        : createTemplate,
    },
    onClose: () => {
      openingTemplateId.value = undefined
    },
  })
}

function openTemplateDialog(template?: MyTemplateItem) {
  if (!template) {
    showTemplateDialog()
    return
  }
  if (openingTemplateId.value !== undefined) {
    return
  }

  openingTemplateId.value = template.id
  markTemplateAsRead(template)
  showTemplateDialog(template, { loadDetail: true })
}

async function createTaskFromTemplate(item: MyTemplateItem) {
  if (creatingTaskId.value) {
    return
  }

  creatingTaskId.value = item.id
  try {
    await openCreateTaskDialog({
      id: item.id,
      kind: item.kind,
      name: item.name,
    })
  }
  finally {
    creatingTaskId.value = undefined
  }
}

async function runTemplateInChat(item: MyTemplateItem) {
  console.info('[skill-template-debug] run template in chat clicked', {
    id: item.id,
    kind: item.kind,
    name: item.name,
    officialTemplateId: item.officialTemplateId,
    metadataKeys: Object.keys(item.metadata ?? {}),
    packageSlug: item.metadata?.packageSlug,
    skillSlug: item.metadata?.skillSlug,
    skillMdPath: item.metadata?.skillMdPath,
    nestedSkillSlug: typeof item.metadata?.skillMetadata === 'object' && item.metadata.skillMetadata !== null
      ? (item.metadata.skillMetadata as Record<string, unknown>).slug
      : undefined,
    installedRootReady: Boolean(getAgentSkillInstalledRoot()),
    installedRoot: getAgentSkillInstalledRoot(),
  })
  if (!getAgentSkillInstalledRoot()) {
    try {
      const info = await agentApi.skillPathInfo()
      console.info('[skill-template-debug] loaded installed Skill root', info)
      setAgentSkillInstalledRoot(info.installedRoot)
    }
    catch (error) {
      console.error('Failed to load Skill installed root', error)
    }
  }
  prompt.value = userTemplateToChatPrompt(item)
  console.info('[skill-template-debug] generated chat prompt from template', {
    id: item.id,
    kind: item.kind,
    prompt: prompt.value,
  })
  void router.push({
    name: 'agent-console-chat',
    query: route.query,
  })
}

function setTemplateDeleting(templateId: number, deleting: boolean) {
  const nextDeletingIds = new Set(deletingTemplateIds.value)
  if (deleting) {
    nextDeletingIds.add(templateId)
  }
  else {
    nextDeletingIds.delete(templateId)
  }
  deletingTemplateIds.value = nextDeletingIds
}

function deleteTemplate(item: MyTemplateItem) {
  confirm.require({
    group: 'agentConsoleDeleteConfirmDialog',
    header: $t('删除模板'),
    message: $t('删除后无法恢复，确认删除模板“{name}”吗？', { name: item.name }),
    acceptLabel: $t('删除'),
    rejectLabel: $t('取消'),
    accept: async () => {
      setTemplateDeleting(item.id, true)
      try {
        await deleteMyTemplate(item, {
          deleteInstalledSkill: agentApi.deleteInstalledSkill,
          deleteRemoteTemplate: async (templateId) => {
            const response = await agentApi.userTemplates.deleteUserTemplate({ templateId })
            readUserTemplateVoidMutation(response, $t('删除模板失败'))
          },
        })
        await fetchAllTemplates()
      }
      catch (error) {
        console.error('Failed to delete user template', error)
        onlyErrorToast(-1, error instanceof Error ? error.message : $t('删除模板失败'))
      }
      finally {
        setTemplateDeleting(item.id, false)
      }
    },
  })
}

function getRouteTemplateId() {
  const value = route.query.editTemplateId
  const normalizedValue = Array.isArray(value) ? value[0] : value
  if (typeof normalizedValue !== 'string') {
    return undefined
  }

  const templateId = Number(normalizedValue)
  return Number.isSafeInteger(templateId) && templateId > 0 ? templateId : undefined
}

async function openRouteTemplate() {
  const templateId = getRouteTemplateId()
  if (!templateId) {
    return
  }

  const template = templates.value.find(item => item.id === templateId)
  await router.replace({
    name: 'agent-console-my-templates',
    query: { ...route.query, editTemplateId: undefined },
  })

  if (template) {
    openTemplateDialog(template)
  }
}

async function fetchAllTemplates() {
  const currentRequest = ++requestSequence
  loading.value = true
  loadError.value = false

  try {
    const rows: UserTemplateDTO[] = []
    let offset = 0
    let expectedTotal = 0

    do {
      const response = await agentApi.userTemplates.listUserTemplates({
        limit: PAGE_SIZE,
        offset,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      })
      const page = readUserTemplatePage(response, $t('加载我的模板失败'))

      if (currentRequest !== requestSequence) {
        return
      }

      rows.push(...page.items)
      expectedTotal = page.total
      offset += page.items.length

      if (page.items.length === 0) {
        break
      }
    } while (offset < expectedTotal)

    if (currentRequest === requestSequence) {
      templates.value = mapTemplates(rows)
      total.value = expectedTotal
    }
  }
  catch (error) {
    if (currentRequest !== requestSequence) {
      return
    }

    console.error('Failed to load user templates', error)
    templates.value = []
    total.value = 0
    loadError.value = true
  }
  finally {
    if (currentRequest === requestSequence) {
      loading.value = false
    }
  }
}

onMounted(() => {
  void (async () => {
    // await agentApi.initializePresetTemplates()
    try {
      const info = await agentApi.skillPathInfo()
      setAgentSkillInstalledRoot(info.installedRoot)
    }
    catch (error) {
      console.error('Failed to load Skill installed root', error)
    }
    await fetchAllTemplates()
    await openRouteTemplate()
  })()
})
</script>

<template>
  <AgentConsolePageLayout
    overflow="auto"
    padding="56px 20px 40px"
    mobile-padding="56px 16px 32px"
    :title="$t('我的模板')"
  >
    <div class="my-templates-content">
      <h1>{{ $t('我的模板') }}</h1>

      <div class="my-templates-toolbar">
        <Skeleton v-if="loading" width="96px" height="20px" border-radius="4px" />
        <span v-else>{{ $t('共 {count} 个模板', { count: total }) }}</span>
        <div class="my-templates-toolbar__actions">
          <button class="my-templates-custom-button" type="button" @click="openCustomTemplateDialog">
            <SvgIcon name="roxy-agent/rx-ic-templates" size="16" aria-hidden="true" />
            {{ $t('定制模板') }}
          </button>
          <button class="my-templates-create-button" type="button" @click="openTemplateDialog()">
            <SvgIcon name="base/rx_ic_plus" size="16" aria-hidden="true" />
            {{ $t('创建模板') }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="my-templates-grid">
        <MyTemplateCardSkeleton :count="6" />
      </div>

      <div v-else-if="loadError" class="my-templates-state">
        <SvgIcon name="roxy-agent/rx-ic-templates" size="32" />
        <strong>{{ $t('我的模板加载失败') }}</strong>
        <span>{{ $t('请检查网络连接后重试。') }}</span>
        <button class="my-templates-state__retry" type="button" @click="fetchAllTemplates">
          {{ $t('重试') }}
        </button>
      </div>

      <div v-else-if="templates.length" class="my-templates-grid">
        <MyTemplateCard
          v-for="item in templates"
          :key="item.id"
          :item="item"
          :unread="templateIsUnread(item)"
          :creating-task="creatingTaskId === item.id"
          :edit-disabled="openingTemplateId !== undefined"
          :deleting="deletingTemplateIds.has(item.id)"
          @edit="openTemplateDialog"
          @delete="deleteTemplate"
          @create-task="createTaskFromTemplate"
          @run-in-chat="runTemplateInChat"
        />
      </div>

      <div v-else class="my-templates-state">
        <SvgIcon name="roxy-agent/rx-ic-templates" size="32" />
        <strong>{{ $t('暂无模板') }}</strong>
        <span>{{ $t('团队空间中还没有模板。') }}</span>
      </div>
    </div>
  </AgentConsolePageLayout>
</template>

<style lang="scss" scoped>
.my-templates-content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;

  > h1 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 24px;
    font-weight: 500;
    line-height: 32px;
  }
}

.my-templates-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;
}

.my-templates-toolbar__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.my-templates-custom-button,
.my-templates-create-button {
  box-sizing: border-box;
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary-inverse);
  border: var(--border-width-border, 1px) solid var(--color-border-secondary);

  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    filter: saturate(1.08) brightness(0.98);
  }
}

.my-templates-custom-button {
  border: 0;
  color: var(--agent-gradient-foreground);
  background: var(--agent-gradient);
}

.my-templates-create-button {
  background: var(--color-bg-primary);
}

.my-templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));
  gap: 12px;
}

.my-templates-state {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  color: var(--color-text-quaternary);

  strong {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  span {
    font-size: 13px;
    line-height: 20px;
  }
}

.my-templates-state__retry {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
  padding: 5px 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  font: inherit;
}

@media (max-width: 520px) {
  .my-templates-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .my-templates-toolbar__actions {
    width: 100%;

    button {
      min-width: 0;
      flex: 1;
    }
  }
}
</style>
