<script setup lang="tsx">
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import batchProxies from './components/batch-proxies.vue'
// import RecommendedProxies from './components/recommended-proxies.vue'
import singleProxies from './components/single-proxies.vue'
import { useDialog } from '/@/hooks/useDialog'
import RxButton from '/@/components/rx-button'
import { getColumns } from './components/columns'
import RyTable from '/@/components/ry-table'

const router = useRouter()
const [_, onlyErrorToast] = useResponseToast()
const [showModal] = useDialog()
const tabs = ref([
  { title: $t('单个添加'), value: 'single' },
  { title: $t('批量添加'), value: 'batch' },
  // { title: $t('代理推荐'), value: 'recommended' },// 第一版不上推荐功能
])
const tabsValue = ref('single')

async function saveProxies(__proxies: any) {
  const proxies = __proxies.reverse()
  const { code, msg, data } = await API.proxy.userAddProxyModuleCreate(proxies)
  if (code === 0) {
    router.replace({ name: 'agent-list' })
  } else if (code === 101 && data) {
    const isAllExist = proxies.length === data?.length;
    const okText = isAllExist ? $t('知道了') : $t('继续并保存')
    const columnKeys = ['protocol', 'host', 'port', 'proxyUserName', 'proxyPassword', 'refreshUrl', 'remark']
    const columns = getColumns().filter(item => columnKeys.includes(item.key as string))
    const dataList = (isAllExist ? proxies : proxies.filter((_item: any, index: number) => !data.some((d: any) => d.index === index))).reverse()
    const onConfirm = async () => {
      if (!isAllExist) {
        await saveProxies(dataList)
      }
      modal.hideModal()
    }
    const modal = showModal({
      header: isAllExist ? $t('代理已存在') : $t('部分代理已存在'),
      class: '!w-[960px]',
      slots: {
        default: () => {
          return <div class={'flex flex-col gap-24px'}>
            <p class={'text-[var(--colors-text-text-error)] text-14px font-400 leading-14px'}>{$t('以下代理已存在于当前代理存储库中，因此不会被添加。')}</p>
            <RyTable columns={columns} dataList={dataList} paginator={false} showTableHeader={false} showActions={false}></RyTable>
          </div>
        },
        footer: () => {
          return <div class='flex gap-10px'>
            {
              !isAllExist ? <RxButton severity="secondary" outlined onClick={() => modal.hideModal()}>{$t('取消')}</RxButton> : null
            }
            <RxButton onClick={onConfirm}>{okText}</RxButton>
          </div>
        }
      }
    })
  } else {
    onlyErrorToast(code, msg)
  }
}


</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <ViewsHeader show-back :divider="false" :title="$t('添加代理')" />
    <div class="proxies-tabs">
      <Tabs v-model:value="tabsValue">
        <TabList>
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
      </Tabs>
    </div>
    <div class="flex-ovh-1 w-full">
      <singleProxies v-show="tabsValue === 'single'" @save="saveProxies" />
      <batchProxies v-show="tabsValue === 'batch'" @save="saveProxies" />
      <!-- <RecommendedProxies v-show="tabsValue === 'recommended'" /> -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies-tabs {
  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--colors-border-divider);

  :deep(.p-tablist-tab-list) {
    gap: var(--spacing-2xl, 16px);
    border-color: transparent;

    .p-tab {
      padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
      color: var(--colors-text-text-secondary, #b2b6b8);
      font-family: Inter;
      font-size: var(--Font-Size-text-sm, 12px);
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      border-color: transparent;

      &:not(.p-tab-active):not(.p-disabled):hover {
        border-color: transparent;
      }
    }

    .p-tab-active {
      color: var(--colors-text-text-brand, #12a3fc);
    }

    .p-tablist-active-bar {
      height: 2px;
    }
  }
}
</style>
