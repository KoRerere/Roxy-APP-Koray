<script setup>
import { ref } from 'vue'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon'
import { getRoleLabelMap } from '/@/enums/'

const props = defineProps({
  projectId: {
    type: Number,
    required: true,
  },
})

const roleLabelMap = getRoleLabelMap()
const op = ref()
const members = ref([])

function toggle(event) {
  op.value.toggle(event)
}

async function getMembers() {
  const { data } = await API.limit.userGetMemberInfoByProjectIdList({
    projectId: props.projectId,
  })
  members.value = data.rows
}

getMembers()
</script>

<template>
  <div class="drop-btn" @click="toggle">
    <span class="text">{{ $t('Members') }}({{ members.length }}) </span> <RxSvgIcon name="base/rx_ic_chevron_down" />
  </div>

  <Popover ref="op">
    <div class="flex flex-col gap-4 w-[20rem]">
      <div>
        <ul class="list-none p-0 m-0 flex flex-col gap-4">
          <li v-for="member in members" :key="member.email" class="flex items-center gap-2">
            <Avatar v-bind="{ [member.avatar ? 'image' : 'label']: member.avatar || member.userName[0] }" style="width: 32px" shape="circle" />
            <div>
              <span class="font-medium">{{ member.userName }}</span>
              <div class="text-sm text-surface-500 dark:text-surface-400">
                {{ member.email }}
              </div>
            </div>
            <div class="flex items-center gap-2 text-surface-500 dark:text-surface-400 ml-auto text-sm">
              <span>{{ roleLabelMap[member.role] }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div class="manage-users">
      {{ $t('Manage Users') }}
    </div>
  </Popover>
</template>

<style lang="scss" scoped>
.drop-btn {
  display: flex;
  min-width: 24px;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm, 4px);
  cursor: pointer;

  .text {
    color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
  }
}
</style>
