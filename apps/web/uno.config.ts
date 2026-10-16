// uno.config.ts
import {
  defineConfig,
  presetAttributify,
  presetMini,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

// 与 theme store 写入的 html[data-theme] 对齐（深色同时会加 .app-dark）
const colorSchemeSelectors = {
  dark: '[data-theme="dark"]',
  light: '[data-theme="light"]',
}

// https://github.com/unocss/unocss#readme
export default defineConfig({
  presets: [
    presetMini({ dark: colorSchemeSelectors }),
    // https://unocss.dev/presets/attributify#properties-conflicts
    presetAttributify({ prefix: 'un-', prefixedOnly: true }),
    presetWind3({
      dark: colorSchemeSelectors,
      // important: 'body'
    }),
  ],
  rules: [['loading-circle', {
    animation: 'loadingCircle 1s infinite linear',
  }]],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  // i18n 会把 locale 写到 <html lang>，用 lang-en:w-40 / lang-zh:(text-sm) 按语言出样式
  variants: [
    {
      name: 'lang',
      match: (matcher) => {
        const m = /^lang-([\w-]+):(.*)$/.exec(matcher)
        if (!m) {
          return
        }
        return {
          matcher: m[2],
          selector: s => `html:lang(${m[1]}) ${s}`,
        }
      },
      autocomplete: 'lang-(zh|zh-CN|en|ru):',
    },
  ],
  shortcuts: {
    'wh-full': 'w-full h-full',
    'flex-ac': 'flex justify-around items-center',
    'flex-bc': 'flex justify-between items-center',
    'flex-cc': 'flex justify-center items-center',
    'flex-ovh-1': 'flex overflow-hidden flex-1',
    'ellipsis-1': 'text-ellipsis overflow-hidden whitespace-nowrap',
    'position-y-center': 'absolute top-1/2 transform -translate-y-1/2',
    'rx-container': 'flex flex-col min-w-[1140px] max-w-[1340px] w-full h-full mx-auto',
    'tt-primary': 'text-[var(--colors-text-text-primary)]',
    'tt-secondary': 'text-[var(--colors-text-text-secondary)]',
    'tt-tertiary': 'text-[var(--colors-text-text-tertiary)]',
    'tt-inactive': 'text-[var(--colors-text-text-inactive)]',
    'tt-brand': 'text-[var(--colors-text-text-brand)]',
    'tt-placeholder': 'text-[var(--colors-text-text-placeholder)]',
    'tt-warning': 'text-[var(--colors-text-text-warning)]',
    'tt-error': 'text-[var(--colors-text-text-error)]',
    'tt-success': 'text-[var(--colors-text-text-success)]',
  },
  theme: {
    colors: {
      red: '#E40000',
    },
  },
})
