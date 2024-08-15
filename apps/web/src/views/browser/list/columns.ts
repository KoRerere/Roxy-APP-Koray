const columnsConfig = {
  key: 'browser.list',
  data: [
    {
      title: '配置文件信息',
      key: 'profile',
      slot: 'profile',
    },
    {
      title: '年龄',
      key: 'age',
    },
    {
      title: '打开/预览',
      key: 'open',
      slot: 'open',
    },
    {
      title: 'getText && classes',
      key: 'address',
      classes: 'custom-class',
      getText: (data: any) => `tags: ${data.tags.join(' ')}`,
    },
    {
      title: '操作项',
      key: 'operation',
      slot: 'operation',
    },
  ],
}

export default columnsConfig
