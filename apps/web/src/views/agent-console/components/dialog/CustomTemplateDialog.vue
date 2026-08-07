<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Ref } from 'vue'
import { useThemeStore } from '/@/stores/theme'
import './agent-dialog.scss'

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
const themeStore = useThemeStore()

const qrcodeImage = computed(() => themeStore.realTheme === 'dark'
  ? '/images/agent-console/custom-template-wechat-dark.png'
  : '/images/agent-console/custom-template-wechat-light.png')

const benefits = computed(() => [
  $t('一对一梳理您的使用场景、目标和风控要求'),
  $t('由专家定制脚本、Skill 和模板，并支持多窗口协同执行'),
  $t('交付即可使用，并提供持续优化、更新和培训服务'),
  $t('适用于批量操作、跨平台账号管理和复杂多步骤工作流程'),
])

function closeDialog() {
  dialogRef?.value.close()
}
</script>

<template>
  <div class="agent-console-dialog__shell custom-template-dialog">
    <header class="agent-console-dialog__header">
      <h2 class="agent-console-dialog__title">
        {{ $t('定制模板') }}
      </h2>
      <button class="agent-console-dialog__close" type="button" :aria-label="$t('关闭自定义模板弹窗')" @click="closeDialog" />
    </header>

    <main class="agent-console-dialog__body custom-template-dialog__body">
      <section class="custom-template-dialog__details">
        <h3>{{ $t('让专家将您的业务流程转化为一键运行的自动化模板。') }}</h3>
        <ul>
          <li v-for="benefit in benefits" :key="benefit">
            <SvgIcon name="roxy-agent/rx-ic-official-badge" size="18" aria-hidden="true" />
            <span>{{ benefit }}</span>
          </li>
        </ul>
      </section>

      <section class="custom-template-dialog__contact">
        <img :src="qrcodeImage" :alt="$t('企业微信客服二维码')">
        <div>
          <strong>{{ $t('使用微信扫码联系自动化专家') }}</strong>
        </div>
      </section>
    </main>

    <footer class="agent-console-dialog__footer">
      <div class="agent-console-dialog__actions">
        <button class="agent-console-dialog__button custom-template-dialog__confirm" type="button" @click="closeDialog">
          {{ $t('知道了') }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.custom-template-dialog__body {
  display: grid;
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 296px) 264px;
  align-items: start;
  gap: 40px;
  padding: 20px;
}

.custom-template-dialog__details {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 32px;

  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 20px;
    font-weight: 600;
    line-height: 24px;
  }

  ul {
    display: flex;
    margin: 0;
    padding: 0;
    flex-direction: column;
    gap: 12px;
    list-style: none;
  }

  li {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;

    > :first-child {
      flex: 0 0 auto;
    }
  }
}

.custom-template-dialog__contact {
  display: flex;
  box-sizing: border-box;
  width: 264px;
  min-height: 316px;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 32px 32px 24px;
  border-radius: 20px;
  background: var(--color-bg-tertiary, #f5f5f5);

  > img {
    display: block;
    width: 200px;
    height: 200px;
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }

  strong {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  span {
    color: var(--color-text-disabled);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }
}

.custom-template-dialog__confirm {
  border: 0;
  color: var(--color-text-primary-inverse);
  background: var(--color-bg-primary-inverse);

  &:hover {
    background: var(--color-bg-primary-inverse-hover);
  }
}

@media (max-width: 640px) {
  .custom-template-dialog__body {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }

  .custom-template-dialog__contact {
    width: min(264px, 100%);
    align-items: center;
    justify-self: center;
    padding: 24px;

    > img {
      width: min(200px, 100%);
      height: auto;
      aspect-ratio: 1;
    }
  }
}
</style>
