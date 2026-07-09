import antfu from '@antfu/eslint-config'

export default antfu(
  {
    yaml: false,
    formatters: true,
    // unocss: true,
    vue: true,
    typescript: true,

    ignores: [
      'packages/backend-api/src/api/*.ts',
      'packages/roxy-crypto/pkg/**/*',
    ],
  },
  {
    // Without `files`, they are general rules for all files
    rules: {
      'no-console': 'off',
      // 'style/multiline-comment-style': ['error', 'starred-block'],
      'jsdoc/convert-to-jsdoc-comments': ['warn'],
      'n/prefer-global/process': 'off',
      'vue/first-attribute-linebreak': 'off',
      'ts/no-unused-expressions': 'off',
      'pnpm/json-enforce-catalog': 'off',
      'e18e/ban-dependencies': 'off',
      'e18e/prefer-spread-syntax': 'off',
      'unused-imports/no-unused-vars': [
        'error',
        {
          caughtErrors: 'none',
          varsIgnorePattern: '^_', // 忽略以 _ 开头的变量
          argsIgnorePattern: '^_', // 忽略以 _ 开头的参数
        },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          ignoreCase: true,
          internalPattern: ['^~/', '^/@/', '^@/'],
          newlinesBetween: 0,
          maxLineLength: undefined,
          groups: [
            'type',
            ['side-effect', 'side-effect-style'],
            ['builtin', 'external'],
            'internal',
            ['parent', 'sibling', 'index'],
            'unknown',
          ],
          environment: 'node',
        },
      ],
    },
  },
  {
    // 排除 apps/web 目录的 sort-imports 规则
    files: ['apps/web/**/*'],
    rules: {
      'perfectionist/sort-imports': 'off',
    },
  },
  {
    // 排除 apps/cloud-browser-gateway 目录的 consistent-type-imports 规则
    files: ['apps/cloud-browser-gateway/**/*'],
    rules: {
      'ts/consistent-type-imports': 'off',
    },
  },
)
