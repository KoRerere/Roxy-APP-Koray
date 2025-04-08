<script setup lang="ts">
import { API } from '/@/api'

const { ids: windowIds } = defineProps<{
  ids: number[]
}>()

const targetWorkspaceId = defineModel('modelValue')

const chooseRef = useTemplateRef('choose')

const search = ref()
const loading = ref(false)

const spaces = [
  {
    title: 'Transfer history',
    items: [
      {
        label: 'XX',
        name: 'Roxy Time',
        id: '0311'
      }
    ],
    clear: (item: any) => {
      console.log(item)
    }
  },
  {
    title: 'My workspaces',
    items: [
      {
        label: 'XX',
        name: 'mannnnnnnnnnnnn',
        id: 'adasd'
      },
      {
        label: 'X2',
        name: 'Roxy Time',
        id: '0348'
      },
      {
        label: 'X3',
        name: 'Roxy Time',
        id: '0881'
      }
    ]
  }
].filter(item => item.items.length)

async function getTransferHistory(event: Event) {
  const { data } = await API.window.userGetTransferWorkspaceListList({
    windowIds: windowIds.join(',')
  })

  console.log(data)

  // chooseRef.value?.show(event)
}

async function onSearch() {
  if (!search.value) return

}

</script>

<template>
  <div class="flex items-center justify-between w-125 pa-2.5 pl-3 select-none cursor-pointer choose" @click="getTransferHistory">
    <span>Choose a space</span>
    <SvgIcon name="base/rx_ic_chevron_down" />

    <RyPopover ref="choose">
      <div class="w-125 relative flex flex-col gap-3 pa-3">
        <RxLoading v-model="loading" />
        <RxInputText v-model="search" left-icon="base/rx_ic_magnify" placeholder="Search workspace ID" :disabled="loading" @keyup.enter="onSearch">
          <template #icon>
            <SvgIcon v-show="search && !loading" class="cursor-pointer" name="base/rx_ic_delete" @click="search = ''"></SvgIcon>
          </template>
        </RxInputText>
        <div class="flex flex-col gap-6">
          <div v-for="space of spaces" :key="space.title">
            <div class="flex justify-between items-center mb-2 title">
              <div>{{ space.title }}</div>
              <div v-if="space.clear" class="flex items-center gap-1 cursor-pointer" @click="space.clear(space)">
                <SvgIcon name="base/rx_ic_bin_1"></SvgIcon>
                <span>Clear history</span>
              </div>
            </div>
            <div v-for="item of space.items" :key="item.id" class="flex items-center gap-3 pa-1.5 workspace">
              <RxAvatar :name="item.label" :size="36" color="orange" :font-size="16" />
              <div>
                <div class="workspace-name">{{ item.name }}</div>
                <div class="mt-1 workspace-id">{{ item.id }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RyPopover>
  </div>
</template>



<style scoped lang="scss">
.choose {
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--Colors-border-border-base, #AFB7BB);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  color: var(--Colors-text-text-placeholder, #575D60);
  font-size: 14px;
  line-height: var(--Line-Height-text-lg, 20px);
}

.title {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.workspace {
  border-bottom: 1px dashed var(--Colors-border-border-inactive, #C7D1D6);

  &:last-of-type {
    border-bottom: none;
  }

  &-name {
    color: var(--Colors-text-text-primary, #111213);
    font-size: 14px;
    font-weight: 600;
    line-height: normal;
  }

  &-id {
    color: var(--Colors-text-text-tertiary, #575D60);
    font-family: "JetBrains Mono";
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>