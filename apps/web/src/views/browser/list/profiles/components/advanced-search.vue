<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { $t } from '/@/locales'

interface Props {
  options?: {
    key: string
    label: string
    icon: string
    syntax: string
  }[]
  search?: (search: Record<string, any>) => void | Promise<void>
  clear?: () => void
}

const { options = [], search, clear } = defineProps<Props>()

const suggestions = computed(() => {
  return options.map(item => ({
    ...item,
    text: $t('搜索{label} {value}', { value: '{value}', label: item.label })
  }))
})

const inputRef = useTemplateRef('input')
const searchQuery = ref('')
const showDropdown = ref(false)
const selectedAdvancedOption = ref<any>(null)
const loading = ref(false)

// Keyboard navigation state: 0 = basic option, 1..N = advanced options
const highlightIndex = ref(0)

// Computed properties
const cleanDisplayQuery = computed(() => {
  return extractBaseQuery(searchQuery.value) || searchQuery.value
})

// Watch for syntax changes - only update highlight, not selected option
watch(searchQuery, (newQuery) => {
  const detectedOption = detectAdvancedSyntax(newQuery)

  // Auto-highlight the matching advanced option if syntax is detected
  if (detectedOption) {
    const optionIndex = suggestions.value.findIndex(option => option.syntax === detectedOption.syntax)
    if (optionIndex !== -1) {
      highlightIndex.value = optionIndex + 1 // +1 because index 0 is basic search
    }
  } else {
    // Reset highlight to basic when no syntax is detected
    highlightIndex.value = 0
  }
})

/**
 * Methods
 */
function detectAdvancedSyntax(query: any) {
  const syntaxMatch = query.match(/^(\w+)::(.*)$/)
  if (syntaxMatch) {
    const syntax = syntaxMatch[1] + '::'
    return suggestions.value.find(option => option.syntax === syntax)
  }
  return null
}

function clearSearch() {
  searchQuery.value = ''
  selectedAdvancedOption.value = undefined
  showDropdown.value = false
  clear?.()
}

function selectBasicSearch() {
  // For basic search, always remove any syntax prefix and execute basic search
  const baseQuery = extractBaseQuery(searchQuery.value)
  searchQuery.value = baseQuery
  selectedAdvancedOption.value = undefined
  showDropdown.value = false
  executeSearch()
}

function extractBaseQuery(query: any) {
  const syntaxMatch = query.match(/^(\w+::)(.*)$/)
  return syntaxMatch ? syntaxMatch[2] : query
}

function selectAdvancedSearch(option: any) {
  selectedAdvancedOption.value = option
  const baseQuery = extractBaseQuery(searchQuery.value)
  searchQuery.value = `${option.syntax}${baseQuery}`
  showDropdown.value = false
  executeSearch()
}

async function executeSearch() {
  inputRef.value?.blur()
  loading.value = true

  const value = selectedAdvancedOption.value
    ? searchQuery.value.replace(new RegExp(selectedAdvancedOption.value.syntax), '')
    : searchQuery.value

  await search?.({ ...selectedAdvancedOption.value, value })
  loading.value = false
}

function handleKeydown(event: any) {
  /**
   * 1 basic + N advanced
   */
  const totalItems = 1 + suggestions.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!showDropdown.value) {
      showDropdown.value = true
    }
    highlightIndex.value = (highlightIndex.value + 1) % totalItems
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!showDropdown.value) {
      showDropdown.value = true
    }
    highlightIndex.value = (highlightIndex.value - 1 + totalItems) % totalItems
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    showDropdown.value = false
    if (highlightIndex.value === 0) {
      // For basic search, always remove any syntax prefix and execute basic search
      const baseQuery = extractBaseQuery(searchQuery.value)
      searchQuery.value = baseQuery
      selectedAdvancedOption.value = undefined
      executeSearch()
    }
    else {
      const option = suggestions.value[highlightIndex.value - 1]
      selectAdvancedSearch(option)
    }
  }
  else if (event.key === 'Escape') {
    showDropdown.value = false
  }
}

function handleBlur() {
  setTimeout(() => {
    showDropdown.value = false
  }, 150)
}
</script>

<template>
  <div class="relative w-full">
    <TsFormInputText ref="input" v-model="searchQuery" size="xxs" preIcon="base/rx_ic_magnify" :placeholder="$t('搜索')" :disabled="loading" @focus="showDropdown = true" @blur="handleBlur"
      @keydown="handleKeydown">
      <template v-if="searchQuery" #icon>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" @click="clearSearch" size="16" />
      </template>
    </TsFormInputText>
    <!-- Dropdown -->
    <div v-if="showDropdown && searchQuery" class="absolute z-50 min-w-100 w-full mt-2 overflow-hidden pa-1 dropdown">
      <div class="flex justify-between py-2 pl-2.5 pr-1.5 option" :class="{ hover: highlightIndex === 0 }" @mousedown="selectBasicSearch" @mouseenter="highlightIndex = 0">
        <i18n-t tag="div" class="text select-none" scope="global" :keypath="$t('搜索 {value}', { value: '{value}' })">
          <template #value>
            <span class="primary">{{ `'${cleanDisplayQuery}'` }}</span>
          </template>
        </i18n-t>
      </div>
      <template v-if="suggestions.length > 0">
        <div class="py-2 px-2.5 header">{{ $t('高级搜索') }}</div>
        <div class="flex justify-between py-2 pl-2.5 pr-1.5 option" :class="[selectedAdvancedOption?.key === option.key ? 'active' : highlightIndex === (idx + 1) ? 'hover' : '']"
          v-for="(option, idx) in suggestions" :key="option.key" @mousedown="selectAdvancedSearch(option)" @mouseenter="highlightIndex = (idx + 1)">
          <div class="flex items-center gap-2">
            <SvgIcon :name="(option.icon as any)" color="var(--colors-icon-icon-inactive)" size="14"></SvgIcon>
            <i18n-t tag="div" class="text select-none" scope="global" :keypath="option.text">
              <template #value>
                <span class="primary">{{ `'${cleanDisplayQuery}'` }}</span>
              </template>
            </i18n-t>
          </div>
          <div class="syntax">{{ option.syntax }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dropdown {
  border-radius: 4px;
  border: 0.5px solid var(--colors-border-border-subtle);
  background: var(--component-dropdown-bg);
  box-shadow: 0 3px 8px 0 rgba(0, 0, 0, 0.07), 0 2px 5px 0 rgba(0, 0, 0, 0.07), 0 1px 1px 0 rgba(0, 0, 0, 0.07);
}

.header {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.option {
  border-radius: 4px;

  &:hover,
  &.hover {
    background: var(--component-dropdown-bg-hover);

    svg {
      color: var(--colors-icon-icon-tertiary);
    }
  }

  &.active {
    background: var(--component-alert-bg-info);

    .text,
    .syntax,
    svg {
      color: var(--colors-text-text-brand);
    }

    .primary {
      color: var(--component-alert-announcement-text-info);
    }
  }
}

.text {
  color: var(--colors-text-text-inactive);
  font-size: 13px;
  line-height: 16px;
}

.primary {
  color: var(--colors-text-text-primary);
  font-weight: 600;
}

.syntax {
  color: var(--colors-text-text-inactive);
  font-family: "JetBrains Mono";
  font-size: 12px;
  line-height: 16px;
}
</style>
