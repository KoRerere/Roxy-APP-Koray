// uno.config.ts
import {
  defineConfig,
  presetAttributify,
  presetMini,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

// https://github.com/unocss/unocss#readme
export default defineConfig({
  presets: [
    presetMini({ dark: 'class' }),
    // https://unocss.dev/presets/attributify#properties-conflicts
    presetAttributify({ prefix: 'un-', prefixedOnly: true }),
    presetUno(),
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
  },
  theme: {
    colors: {
      red: '#E40000',
    },
  },
})
