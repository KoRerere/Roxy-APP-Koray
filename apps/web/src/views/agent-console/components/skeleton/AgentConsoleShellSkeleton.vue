<script setup lang="ts">
import HomeTemplateCardSkeleton from './HomeTemplateCardSkeleton.vue'
</script>

<template>
  <main class="agent-console-shell-skeleton" role="status" aria-busy="true">
    <span class="sr-only">{{ $t('加载中...') }}</span>

    <aside class="agent-console-shell-skeleton__sidebar" aria-hidden="true">
      <div class="agent-console-shell-skeleton__brand">
        <Skeleton width="32px" height="32px" shape="circle" />
        <Skeleton width="116px" height="18px" border-radius="6px" />
      </div>

      <nav class="agent-console-shell-skeleton__nav">
        <div
          v-for="index in 4"
          :key="index"
          class="agent-console-shell-skeleton__nav-item"
          :class="{ 'agent-console-shell-skeleton__nav-item--active': index === 1 }"
        >
          <Skeleton width="18px" height="18px" border-radius="6px" />
          <Skeleton width="88px" height="12px" border-radius="4px" />
        </div>
      </nav>

      <Skeleton width="42px" height="12px" border-radius="4px" />

      <div class="agent-console-shell-skeleton__conversation-list">
        <Skeleton
          v-for="index in 10"
          :key="index"
          :width="index % 3 === 0 ? '78%' : index % 4 === 0 ? '88%' : '100%'"
          height="17px"
          border-radius="4px"
        />
      </div>

      <div class="agent-console-shell-skeleton__sidebar-footer">
        <Skeleton width="100%" height="16px" border-radius="4px" />
        <Skeleton width="64%" height="16px" border-radius="4px" />
        <Skeleton width="100%" height="40px" border-radius="10px" />
      </div>
    </aside>

    <section class="agent-console-shell-skeleton__workspace" aria-hidden="true">
      <div class="agent-console-shell-skeleton__panel">
        <div class="agent-console-shell-skeleton__hero">
          <Skeleton width="56px" height="56px" shape="circle" />
          <Skeleton width="min(420px, 54%)" height="34px" border-radius="8px" />
          <Skeleton width="min(310px, 38%)" height="16px" border-radius="4px" />
        </div>

        <div class="agent-console-shell-skeleton__body">
          <div class="agent-console-shell-skeleton__template-grid">
            <HomeTemplateCardSkeleton :count="6" />
          </div>

          <div class="agent-console-shell-skeleton__composer">
            <Skeleton width="86%" height="14px" border-radius="4px" />
            <Skeleton width="52%" height="14px" border-radius="4px" />
            <div class="agent-console-shell-skeleton__composer-toolbar">
              <Skeleton width="76px" height="28px" border-radius="999px" />
              <Skeleton width="76px" height="28px" border-radius="999px" />
              <Skeleton width="76px" height="28px" border-radius="999px" />
              <Skeleton width="28px" height="28px" shape="circle" />
              <Skeleton class="agent-console-shell-skeleton__send" width="34px" height="34px" shape="circle" />
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style lang="scss" scoped>
.agent-console-shell-skeleton {
  display: grid;
  grid-template-columns: 220px minmax(460px, 1fr);
  width: 100vw;
  height: 100vh;
  height: 100svh;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  background: var(--color-bg-tertiary, #f5f5f5);
  overflow: hidden;
}

.agent-console-shell-skeleton__sidebar {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  padding: 16px 14px;
  background: var(--color-bg-tertiary);
}

.agent-console-shell-skeleton__brand {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 10px;
}

.agent-console-shell-skeleton__nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-console-shell-skeleton__nav-item {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-radius: 10px;
}

.agent-console-shell-skeleton__nav-item--active {
  background: var(--color-bg-tertiary-hover, rgba(0, 0, 0, 0.05));
}

.agent-console-shell-skeleton__conversation-list {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.agent-console-shell-skeleton__sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}

.agent-console-shell-skeleton__workspace {
  min-width: 0;
  min-height: 0;
  background: var(--color-bg-tertiary);
  overflow: hidden;
}

.agent-console-shell-skeleton__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: calc(100% - 10px);
  height: calc(100% - 20px);
  margin: 10px 10px 10px 0;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.agent-console-shell-skeleton__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 56px;
  flex: 0 0 auto;
}

.agent-console-shell-skeleton__body {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.agent-console-shell-skeleton__template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: min(800px, calc(100% - 64px));
  margin: 34px auto 0;
}

.agent-console-shell-skeleton__body > .agent-console-shell-skeleton__composer {
  margin-top: auto;
}

.agent-console-shell-skeleton__composer {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(800px, calc(100% - 64px));
  min-height: 128px;
  margin: 18px auto 20px;
  padding: 16px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 18px;
  background: var(--color-bg-primary);
  box-shadow: 0 24px 80px rgba(214, 200, 226, 0.28);
}

.agent-console-shell-skeleton__composer-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
}

.agent-console-shell-skeleton__send {
  margin-left: auto;
}
</style>
