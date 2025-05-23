<script lang="ts" setup>
import { RxSvgIcon } from '/@/components/rx-icon'
import { getRoleLabelMap } from '/@/enums/'

const { members = [] } = defineProps<{
  members: any[]
}>()

const roleLabelMap = getRoleLabelMap()
const opRef = useTemplateRef('op')

function toggle(event: Event) {
  opRef.value?.toggle(event)
}
</script>

<template>
  <div class="drop-btn" @click="toggle">
    <span class="text">{{ $t('成员') }}({{ members?.length || 0 }}) </span>
    <RxSvgIcon name="base/rx_ic_chevron_down" />
  </div>

  <Popover ref="op" :pt="{ content: { class: $style['popper-content'] } }">
    <div class="flex flex-col gap-4">
      <div>
        <div class="member-list">
          <div v-for="member in members" :key="member.email" class="member-item">
            <RxAvatar :avatar="member.avatar" :name="member.userName?.slice(0, 2)" :color="member.avatarColor" :size="32" :font-size="16" />
            <div>
              <span class="font-medium">{{ member.userName }}</span>
              <div class="text-sm text-surface-500 dark:text-surface-400">
                {{ member.email }}
              </div>
            </div>
            <div class="flex items-center gap-2 text-surface-500 dark:text-surface-400 ml-auto text-sm flex-shrink-0">
              <span>{{ roleLabelMap[member.role as keyof typeof roleLabelMap] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="manage-users">
      <RouterLink :to="{ name: 'teams' }">{{ $t('管理成员') }}</RouterLink>
    </div>
  </Popover>
</template>

<style lang="scss" module>
.popper-content {
  padding: 0 !important;
}
</style>

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
    color: var(--colors-text-text-primary, #171c1f);
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }
}

.manage-users {
  display: flex;
  padding: 10px var(--spacing-md, 6px) 10px 10px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);
  background: var(--colors-background-bg-app, #fff);
  color: var(--colors-text-text-brand, #12a3fc);
  text-align: center;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 123.077% */
}

.member-list {
  display: flex;
  padding: var(--spacing-sm, 4px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  align-self: stretch;
  border-bottom: 0.5px solid var(--colors-border-border-base, #c7cdd1);
}

.member-item {
  display: flex;
  padding: 8px var(--spacing-md, 6px) 8px 10px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);
  background: var(--colors-background-bg-app, #fff);
}
</style>
