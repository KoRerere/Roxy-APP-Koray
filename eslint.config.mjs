import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    // unocss: true,
    vue: true,
    typescript: true,

    ignores: [
      'packages/backend-api/src/api/*.ts',
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
      'unused-imports/no-unused-vars': [
        'error',
        {
          caughtErrors: 'none',
          varsIgnorePattern: '^_', // 忽略以 _ 开头的变量
          argsIgnorePattern: '^_', // 忽略以 _ 开头的参数
        },
      ],
    },
  },
)
