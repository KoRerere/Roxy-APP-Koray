import { defineMetadata } from '../src/index'

defineMetadata({ name: 'Search YouTube', description: 'Searches videos.' })

defineMetadata({
  name: { zh: '搜索视频', us: 'Search videos', ru: 'Поиск видео' },
  description: {
    zh: ['# 功能', '搜索并观看视频。'],
    us: '# Purpose\nSearch and watch videos.',
    ru: ['# Назначение', 'Поиск и просмотр видео.'],
  },
})

defineMetadata({
  name: 'Markdown description',
  description: ['# Purpose', 'Run the script.'],
})

// @ts-expect-error name does not accept Markdown line arrays.
defineMetadata({ name: ['Search', 'videos'] })

// @ts-expect-error localized names must include zh, us, and ru.
defineMetadata({ name: { zh: '搜索视频', us: 'Search videos' } })
