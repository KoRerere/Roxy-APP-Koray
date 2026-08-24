# Localized Display Text

A script's self-description can be multi-language. `defineMetadata` and
`defineParams` accept a localized `{ zh, us, ru }` form for display text, so the
same script surfaces its name, description, and parameter labels in the user's
language.

```typescript
defineMetadata({
  name: { zh: '搜索视频', us: 'Search videos', ru: 'Поиск видео' },
  description: {
    zh: ['# 功能', '搜索并观看视频。'],
    us: ['# Purpose', 'Search and watch videos.'],
    ru: ['# Назначение', 'Поиск и просмотр видео.']
  }
})

defineParams({
  type: 'object',
  properties: {
    keyword: {
      type: 'string',
      description: {
        zh: '搜索关键词',
        us: 'Search keyword',
        ru: 'Ключевое слово для поиска'
      }
    }
  },
  required: ['keyword']
})
```

Rules when using this form:

- Include all three `zh`, `us`, and `ru` keys.
- Metadata `name` values are strings only.
- Metadata and parameter descriptions may be strings or string arrays; arrays
  are convenient for multi-paragraph Markdown.
- Keep every value a static literal — the same pre-run check that applies to
  plain-string metadata applies here.
