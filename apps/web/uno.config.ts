// uno.config.ts
import {
  defineConfig,
  presetAttributify,
  presetMini,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

// https://github.com/unocss/unocss#readme
export default defineConfig({
  presets: [
    presetMini({ dark: 'class' }),
    // https://unocss.dev/presets/attributify#properties-conflicts
    presetAttributify({ prefix: 'un-', prefixedOnly: true }),
    presetWind3({
      // important: 'body'
    }),
  ],
  rules: [['loading-circle', {
    animation: 'loadingCircle 1s infinite linear',
  }]],
  transformers: [transformerDirectives(), transformerVariantGroup()],
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
  },
  theme: {
    colors: {
      red: '#E40000',
    },
  },
})
