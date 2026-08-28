<script setup lang="ts">
import type { UserTemplateCreate } from '@roxy/agent-api'
import AgentConsolePageLayout from '../components/AgentConsolePageLayout.vue'
import TemplateStoreCard from '../components/TemplateStoreCard.vue'
import TemplateStoreCardSkeleton from '../components/skeleton/TemplateStoreCardSkeleton.vue'
import TemplateFilterSkeleton from '../components/skeleton/TemplateFilterSkeleton.vue'
import CustomTemplateBanner from '../components/CustomTemplateBanner.vue'
import CreateTemplateDialog from '../components/dialog/CreateTemplateDialog.vue'
import { useCreateTaskDialog } from '../composables/useCreateTaskDialog'
import { useCustomTemplateDialog } from '../composables/useCustomTemplateDialog'
import { useDelayedLoading } from '../composables/useDelayedLoading'
import { useTemplateTaskExecution } from '../composables/useTemplateTaskExecution'
import {
  buildCustomTemplateRequest,
  buildOfficialTemplateUserMap,

  normalizeMyTemplateKind,
  readUserTemplateMutation,
  readUserTemplatePage,

} from '../my-templates'
import type { CustomTemplatePayload, UserTemplateDTO } from '../my-templates'
import { prepareOfficialTemplateAcquisition } from '../official-template-acquisition'
import { markTemplateRead, markTemplateUnread } from '../template-unread'
import {
  mapTemplateStoreItem,

  pickLocalized,
  readCatalogList,
  serializeTemplateQuery,

} from '../template-store'
import type { OfficialTemplate, TemplateFilterCategory, TemplateLabel, TemplateLabelCategory, TemplateStoreItem } from '../template-store'
import { readTemplateLabelCatalogCache, writeTemplateLabelCatalogCache } from '../template-label-cache'
import { useSimpleLocale } from '/@/stores/locale'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useAgentConsoleApi } from '../api'
import { useDialog } from 'primevue/usedialog'

const PAGE_SIZE = 200

const prompt = defineModel<string>('prompt', { required: true })

const localeStore = useSimpleLocale()
const themeStore = useThemeStore()
const agentApi = useAgentConsoleApi()
const dialog = useDialog()
const route = useRoute()
const router = useRouter()
const [showToast, onlyErrorToast] = useResponseToast()
const { openCreateTaskDialog } = useCreateTaskDialog()
const { openCustomTemplateDialog } = useCustomTemplateDialog()
const { executeTemplateTask, findTaskByUserTemplateId } = useTemplateTaskExecution(prompt)
const storeBackground = computed(() => themeStore.realTheme === 'dark'
  ? '/images/agent-console/template-store-bg-dark.png'
  : '/images/agent-console/template-store-bg-light.svg')
const cachedLabelCatalog = readTemplateLabelCatalogCache()
const categories = ref<TemplateLabelCategory[]>(cachedLabelCatalog?.categories ?? [])
const labels = ref<TemplateLabel[]>(cachedLabelCatalog?.labels ?? [])
const templates = ref<TemplateStoreItem[]>([])
const officialTemplates = ref<OfficialTemplate[]>([])
const userTemplates = ref<UserTemplateDTO[]>([])
const selectedLabelIds = reactive<Record<number, number | 'all'>>({})
const templateActions = reactive<Record<number, 'get' | 'run' | undefined>>({})
const catalogLoading = ref(!cachedLabelCatalog)
const templatesLoading = ref(true)
const catalogError = ref(false)
const templatesError = ref(false)
const isPageLoading = computed(() => catalogLoading.value || templatesLoading.value)
const showLoadingSkeleton = useDelayedLoading(isPageLoading)
const isCustomBannerHidden = ref(false)
let hasLabelCatalog = Boolean(cachedLabelCatalog)
let templateRequestSequence = 0
let lastTemplatePanelScrollTop = 0

function reconcileSelectedLabelIds(nextCategories: TemplateLabelCategory[], nextLabels: TemplateLabel[]) {
  const categoryIds = new Set(nextCategories.map(category => category.id))
  let activeSelectionChanged = false

  Object.keys(selectedLabelIds).forEach((categoryIdValue) => {
    const categoryId = Number(categoryIdValue)
    if (categoryIds.has(categoryId)) {
      return
    }

    if (typeof selectedLabelIds[categoryId] === 'number') {
      activeSelectionChanged = true
    }
    delete selectedLabelIds[categoryId]
  })

  nextCategories.forEach((category) => {
    const selectedLabelId = selectedLabelIds[category.id]
    if (selectedLabelId === undefined) {
      selectedLabelIds[category.id] = 'all'
      return
    }

    if (typeof selectedLabelId === 'number'
      && !nextLabels.some(label => label.categoryId === category.id && label.id === selectedLabelId)) {
      selectedLabelIds[category.id] = 'all'
      activeSelectionChanged = true
    }
  })

  return activeSelectionChanged
}

function applyLabelCatalog(nextCategories: TemplateLabelCategory[], nextLabels: TemplateLabel[]) {
  categories.value = nextCategories
  labels.value = nextLabels
  return reconcileSelectedLabelIds(nextCategories, nextLabels)
}

reconcileSelectedLabelIds(categories.value, labels.value)

const filterCategories = computed<TemplateFilterCategory[]>(() => categories.value.map((category) => {
  const label = pickLocalized(category.name, localeStore.currentLocale) || category.slug

  return {
    id: category.id,
    label: category.slug === 'platform' || label === $t('平台') ? $t('账号平台') : label,
    options: [
      { label: $t('全部'), value: 'all' },
      ...labels.value
        .filter(label => label.categoryId === category.id)
        .map(label => ({
          label: pickLocalized(label.name, localeStore.currentLocale) || label.slug,
          value: label.id,
        })),
    ],
  }
}))

const activeLabelIds = computed(() => categories.value.flatMap((category) => {
  const labelId = selectedLabelIds[category.id]
  return typeof labelId === 'number' ? [labelId] : []
}))

const hasActiveFilters = computed(() => activeLabelIds.value.length > 0)
const installedTemplateMap = computed(() => buildOfficialTemplateUserMap(userTemplates.value))
// 筛选切换时沿用上一次的结果数，避免卡片区在骨架与真实列表之间大幅塌陷或撑高
const filteringSkeletonCount = computed(() => Math.min(9, Math.max(3, templates.value.length)))

function mapTemplates(rows: OfficialTemplate[]) {
  return rows.map(row => mapTemplateStoreItem(row, localeStore.currentLocale))
}

async function fetchTemplates() {
  const requestSequence = ++templateRequestSequence
  templatesLoading.value = true
  templatesError.value = false

  try {
    const response = await agentApi.templates.listOfficialTemplates(
      activeLabelIds.value.length ? { labelIds: activeLabelIds.value } : {},
      { paramsSerializer: serializeTemplateQuery },
    )
    const rows = readCatalogList<OfficialTemplate>(response, $t('加载官方模板失败'))

    if (requestSequence === templateRequestSequence) {
      officialTemplates.value = rows
      templates.value = mapTemplates(rows)
    }
  }
  catch (error) {
    if (requestSequence !== templateRequestSequence) {
      return
    }

    console.error('Failed to load official templates', error)
    templatesError.value = true
    officialTemplates.value = []
    templates.value = []
  }
  finally {
    if (requestSequence === templateRequestSequence) {
      templatesLoading.value = false
    }
  }
}

async function fetchLabelCatalog() {
  if (!hasLabelCatalog) {
    catalogLoading.value = true
  }
  catalogError.value = false

  try {
    const [categoryResponse, labelResponse] = await Promise.all([
      agentApi.templates.listTemplateLabelCategories(),
      agentApi.templates.listTemplateLabels({}),
    ])
    const nextCategories = readCatalogList<TemplateLabelCategory>(categoryResponse, $t('加载标签分类失败'))
    const nextLabels = readCatalogList<TemplateLabel>(labelResponse, $t('加载模板标签失败'))
    const activeSelectionChanged = applyLabelCatalog(nextCategories, nextLabels)

    hasLabelCatalog = true
    writeTemplateLabelCatalogCache(nextCategories, nextLabels)

    if (activeSelectionChanged) {
      void fetchTemplates()
    }
  }
  catch (error) {
    console.error('Failed to load template label catalog', error)
    if (!hasLabelCatalog) {
      catalogError.value = true
      categories.value = []
      labels.value = []
    }
  }
  finally {
    catalogLoading.value = false
  }
}

async function fetchUserTemplates() {
  const rows: UserTemplateDTO[] = []
  let offset = 0
  let expectedTotal = 0

  try {
    do {
      const response = await agentApi.userTemplates.listUserTemplates({
        limit: PAGE_SIZE,
        offset,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      })
      const page = readUserTemplatePage(response, $t('加载已获取模板失败'))
      rows.push(...page.items)
      expectedTotal = page.total
      offset += page.items.length
      if (!page.items.length) {
        break
      }
    } while (offset < expectedTotal)

    userTemplates.value = rows
  }
  catch (error) {
    console.error('Failed to load installed templates', error)
  }
}

function selectLabel(categoryId: number, value: unknown) {
  selectedLabelIds[categoryId] = typeof value === 'number' ? value : 'all'
  void fetchTemplates()
}

async function openTaskAndRun(template: UserTemplateDTO) {
  await openCreateTaskDialog({
    id: template.id,
    kind: normalizeMyTemplateKind(template.templateType),
    name: template.name,
  }, {
    onCreated: task => executeTemplateTask(task, template),
  })
}

async function createOfficialUserTemplate(
  templateId: number,
  request: UserTemplateCreate,
  saveAndRun: boolean,
) {
  templateActions[templateId] = saveAndRun ? 'run' : 'get'
  try {
    const response = await agentApi.userTemplates.createUserTemplate(request)
    const template = readUserTemplateMutation(response, $t('获取模板失败'))
    markTemplateUnread(template)
    userTemplates.value = [template, ...userTemplates.value]
    showToast(0, $t('模板已添加，点击查看详情'), {
      onClick: () => {
        void router.push({
          name: 'agent-console-my-templates',
          query: { ...route.query, editTemplateId: String(template.id) },
        })
      },
    })

    if (saveAndRun) {
      markTemplateRead(template)
      window.setTimeout(() => {
        void openTaskAndRun(template)
      })
    }
    return true
  }
  catch (error) {
    console.error('Failed to create official user template', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('获取模板失败'))
    return false
  }
  finally {
    delete templateActions[templateId]
  }
}

async function saveOfficialTemplate(templateId: number, payload: CustomTemplatePayload) {
  return createOfficialUserTemplate(
    templateId,
    buildCustomTemplateRequest(payload),
    payload.saveAndRun,
  )
}

function openOfficialTemplateDialog(templateId: number, submitMode: 'run' | 'save') {
  if (templateActions[templateId]) {
    return
  }
  const officialTemplate = officialTemplates.value.find(template => template.id === templateId)
  if (!officialTemplate) {
    onlyErrorToast(-1, $t('官方模板不存在或已下架'))
    return
  }

  templateActions[templateId] = submitMode === 'run' ? 'run' : 'get'
  const clearAction = () => {
    delete templateActions[templateId]
  }
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
      officialTemplate,
      lockSource: true,
      submitMode,
      onCancel: clearAction,
      onSave: (payload: CustomTemplatePayload) => saveOfficialTemplate(templateId, payload),
    },
    onClose: clearAction,
  })
}

async function acquireTemplate(templateId: number, saveAndRun: boolean) {
  if (templateActions[templateId]) {
    return
  }
  const officialTemplate = officialTemplates.value.find(template => template.id === templateId)
  if (!officialTemplate) {
    onlyErrorToast(-1, $t('官方模板不存在或已下架'))
    return
  }

  const acquisition = prepareOfficialTemplateAcquisition(
    officialTemplate,
    localeStore.currentLocale,
  )
  if (acquisition.requiresConfirmation) {
    openOfficialTemplateDialog(templateId, saveAndRun ? 'run' : 'save')
    return
  }

  await createOfficialUserTemplate(templateId, acquisition.request, saveAndRun)
}

function addTemplate(templateId: number) {
  void acquireTemplate(templateId, false)
}

async function runInstalledTemplate(templateId: number, template: UserTemplateDTO) {
  if (templateActions[templateId]) {
    return
  }

  templateActions[templateId] = 'run'
  try {
    const task = await findTaskByUserTemplateId(template.id)
    if (task) {
      await executeTemplateTask(task, template)
      return
    }
    await openTaskAndRun(template)
  }
  catch (error) {
    console.error('Failed to prepare installed template task', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('加载任务失败'))
  }
  finally {
    delete templateActions[templateId]
  }
}

function runTemplate(templateId: number) {
  const installedTemplate = installedTemplateMap.value.get(templateId)
  if (installedTemplate) {
    void runInstalledTemplate(templateId, installedTemplate)
    return
  }
  void acquireTemplate(templateId, true)
}

function handleTemplatePanelScroll(event: Event) {
  const panel = event.target
  if (!(panel instanceof HTMLElement) || !panel.matches('[data-agent-page-scroll]')) {
    return
  }

  const scrollTop = panel.scrollTop
  const delta = scrollTop - lastTemplatePanelScrollTop

  if (scrollTop <= 0) {
    isCustomBannerHidden.value = false
  }
  else if (Math.abs(delta) >= 4) {
    isCustomBannerHidden.value = delta > 0
  }

  lastTemplatePanelScrollTop = scrollTop
}

onMounted(() => {
  void Promise.all([fetchLabelCatalog(), fetchTemplates(), fetchUserTemplates()])
})
</script>

<template>
  <AgentConsolePageLayout
    class="template-store-workspace"
    overflow="auto"
    padding="0"
    mobile-padding="0"
    :class="{ 'template-store-workspace--dark': themeStore.realTheme === 'dark' }"
    :style="{ backgroundImage: `url(${storeBackground})` }"
    :title="$t('模板商城')"
    @scroll="handleTemplatePanelScroll"
  >
    <section class="template-store-panel">
      <div class="template-store-content">
        <h1>{{ $t('模板商城') }}</h1>

        <template v-if="catalogLoading">
          <template v-if="showLoadingSkeleton">
            <TemplateFilterSkeleton />
            <div class="template-store-grid">
              <TemplateStoreCardSkeleton :count="6" />
            </div>
          </template>
        </template>

        <div v-else-if="catalogError" class="template-store-state">
          <SvgIcon name="roxy-agent/rx-ic-templates" size="32" />
          <strong>{{ $t('模板商城加载失败') }}</strong>
          <span>{{ $t('请检查网络连接后重试。') }}</span>
          <button class="template-store-state__retry" type="button" @click="fetchLabelCatalog">
            {{ $t('重试') }}
          </button>
        </div>

        <template v-else>
          <div v-if="filterCategories.length" class="template-store-filters">
            <section
              v-for="category in filterCategories"
              :key="category.id"
              class="template-store-filter"
              :aria-labelledby="`template-filter-${category.id}`"
            >
              <h2 :id="`template-filter-${category.id}`">
                {{ category.label }}
              </h2>
              <RxSelectButton
                :model-value="selectedLabelIds[category.id] ?? 'all'"
                class="template-store-filter__control"
                :options="category.options"
                option-label="label"
                option-value="value"
                data-key="value"
                size="lg"
                :disabled="templatesLoading"
                :aria-labelledby="`template-filter-${category.id}`"
                @update:model-value="selectLabel(category.id, $event)"
              />
            </section>
          </div>

          <template v-if="templatesLoading">
            <div v-if="showLoadingSkeleton" class="template-store-grid">
              <TemplateStoreCardSkeleton :count="filteringSkeletonCount" />
            </div>
          </template>

          <div v-else-if="templatesError" class="template-store-state template-store-state--compact">
            <SvgIcon name="roxy-agent/rx-ic-templates" size="32" />
            <strong>{{ $t('官方模板加载失败') }}</strong>
            <span>{{ $t('请稍后重试。') }}</span>
            <button class="template-store-state__retry" type="button" @click="fetchTemplates">
              {{ $t('重试') }}
            </button>
          </div>

          <div v-else-if="templates.length" class="template-store-grid">
            <TemplateStoreCard
              v-for="item in templates"
              :key="item.id"
              :item="item"
              :installed="installedTemplateMap.has(item.id)"
              :busy-action="templateActions[item.id]"
              @get="addTemplate"
              @run="runTemplate"
            />
          </div>

          <div v-else class="template-store-state template-store-state--compact">
            <SvgIcon name="roxy-agent/rx-ic-templates" size="32" />
            <strong>{{ hasActiveFilters ? $t('没有找到匹配的模板') : $t('暂无官方模板') }}</strong>
            <span v-if="hasActiveFilters">{{ $t('请尝试选择其他标签。') }}</span>
          </div>
        </template>
      </div>
    </section>

    <template #overlay>
      <div
        v-if="!catalogLoading && !catalogError"
        class="template-store-floating-banner"
        :class="{ 'template-store-floating-banner--hidden': isCustomBannerHidden }"
        :aria-hidden="isCustomBannerHidden"
      >
        <CustomTemplateBanner @open="openCustomTemplateDialog" />
      </div>
    </template>
  </AgentConsolePageLayout>
</template>

<style lang="scss" scoped>
.template-store-workspace {
  --template-store-banner-bottom: 12px;
  --template-store-banner-height: 81px;

  position: relative;
  background-color: var(--color-bg-primary);
  background-position: top center;
  background-repeat: no-repeat;
  background-size: 100% auto;

  &::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 6;
    height: var(--template-store-banner-bottom);
    background: var(--color-bg-primary);
    content: '';
    pointer-events: none;
  }
}

.template-store-panel {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  min-width: 0;
  padding: 56px 20px calc(var(--template-store-banner-height) + var(--template-store-banner-bottom) + 24px);
}

.template-store-content {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 24px;
  margin: 0 auto;

  > h1 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 24px;
    font-weight: 500;
    line-height: 32px;
  }
}

.template-store-filters {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.template-store-filter {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 16px;

  h2 {
    display: flex;
    height: 28px;
    flex: 0 0 auto;
    align-items: center;
    margin: 0;
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }
}

:deep(.template-store-filter__control.p-selectbutton) {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

:deep(.template-store-filter__control .p-togglebutton) {
  height: 28px;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
}

:deep(.template-store-filter__control .p-togglebutton:first-child),
:deep(.template-store-filter__control .p-togglebutton:last-child) {
  border-radius: 999px;
}

:deep(.template-store-filter__control .p-togglebutton:focus-visible) {
  outline: 0;
  box-shadow: var(--agent-focus-ring);
}

:deep(.template-store-filter__control .p-togglebutton .p-ink) {
  border-radius: 999px;
}

:deep(.template-store-filter__control .p-togglebutton-content) {
  display: flex;
  box-sizing: border-box;
  height: 28px;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  padding: 3px 15px;
  border: 1px solid var(--color-border-primary);
  border-radius: 999px;
  color: var(--color-text-primary);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.template-store-filter__control .p-togglebutton:not(.p-togglebutton-checked):hover .p-togglebutton-content) {
  background: var(--color-bg-secondary-hover);
}

:deep(.template-store-filter__control .p-togglebutton-checked .p-togglebutton-content) {
  border-color: var(--color-bg-primary-inverse);
  color: var(--color-text-primary-inverse);
  background: var(--color-bg-primary-inverse);
}

.template-store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));
  gap: 12px;
  min-width: 0;
}

.template-store-state {
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

.template-store-state--compact {
  min-height: 160px;
}

.template-store-state__retry {
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

  &:hover {
    background: var(--color-bg-quaternary);
  }
}

.template-store-floating-banner {
  position: absolute;
  right: 20px;
  bottom: var(--template-store-banner-bottom);
  left: 20px;
  z-index: 7;
  width: auto;
  max-width: 882px;
  margin: 0 auto;
  border-radius: 10px;
  box-shadow: var(--agent-floating-banner-shadow);
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.template-store-floating-banner--hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(calc(100% + var(--template-store-banner-bottom) + 8px));
}

@media (max-width: 760px) {
  .template-store-panel {
    padding-right: 16px;
    padding-left: 16px;
  }

  .template-store-floating-banner {
    right: 16px;
    left: 16px;
  }
}

@media (max-width: 680px) {
  .template-store-workspace {
    --template-store-banner-bottom: 8px;
    --template-store-banner-height: 125px;
  }
}

@media (max-width: 520px) {
  .template-store-workspace {
    --template-store-banner-height: 145px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .template-store-floating-banner {
    transition: opacity 120ms ease;
  }
}
</style>
