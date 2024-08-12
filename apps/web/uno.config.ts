// uno.config.ts
import {
  defineConfig,
  presetMini,
  presetAttributify,
  presetUno,
  transformerDirectives,
  transformerVariantGroup
} from 'unocss'

// https://github.com/unocss/unocss#readme
export default defineConfig({
  presets: [
    presetMini({ dark: 'class' }),
    // https://unocss.dev/presets/attributify#properties-conflicts
    presetAttributify({ prefix: 'un-', prefixedOnly: true }),
    presetUno()
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  shortcuts: {
    'wh-full': 'w-full h-full',
    'flex-ac': 'flex justify-around items-center',
    'flex-bc': 'flex justify-between items-center'
  },
  theme: {
    colors: {
      red: '#E40000'
    }
  }
})
