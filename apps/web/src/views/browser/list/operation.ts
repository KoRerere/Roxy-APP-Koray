export const operation = [
  {
    key: 'Test',
    name: '测试',
    label: '测试',
    icon: 'mdi mdi-wifi-off',
    quick: true,
    command: () => {
      console.log('🚀 ~Test:', 'test')
    },
  },
  {
    key: 'edit',
    name: '编辑',
    label: '编辑',
    icon: 'mdi mdi-refresh',
    quick: true,
    command: () => { },
  },
  {
    key: 'Delete',
    name: '删除',
    label: '删除',
    icon: 'mdi mdi-file-document-plus-outline',
    quick: true,
    command: () => { },
  },
]

export const sorts = [
  {
    label: '城市',
    name: 'city',
    value: null,
    placeholder: '请选择城市',
    icon: 'mdi-sort-descending',
    options: [
      { label: 'New York', value: 'NY' },
      { label: 'Rome', value: 'RM' },
      { label: 'London', value: 'LDN' },
      { label: 'Istanbul', value: 'IST' },
      { label: 'Paris', value: 'PRS' },
    ],
  },
  {
    label: '排序',
    name: 'order',
    value: null,
    placeholder: '请选择排序',
    icon: 'mdi-sort-descending',
    options: [
      { label: '升序', value: 'NY' },
      { label: '降序', value: 'RM' },
    ],
  },
  {
    name: 'time',
    label: '时间',
    placeholder: '请选择时间',
    value: null,
    icon: 'mdi-sort-descending',
    options: [
      { label: '创建时间', value: 'create' },
      { label: '修改时间', value: 'modify' },
    ],
  },
]

export const filters = [
  {
    label: 'city',
    name: 'city',
    value: null,
    placeholder: '筛选',
    options: [
      { label: '北京', value: 'bj' },
      { label: '上海', value: 'sh' },
      { label: '广州', value: 'gz' },
      { label: '深圳', value: 'sz' },
      { label: '杭州', value: 'hz' },
    ],
  },
  {
    label: 'city2',
    name: 'city2',
    value: null,
    placeholder: '筛选2',
    options: [
      { label: '北京', value: 'bj' },
      { label: '上海', value: 'sh' },
      { label: '广州', value: 'gz' },
      { label: '深圳', value: 'sz' },
      { label: '杭州', value: 'hz' },
    ],
  },
]

export async function operationHandler({ key }: any, data: any) {
  data = [].concat(data) // 有批量操作
  switch (key) {
    case 'Test':
    {
      console.log('🚀 ~test:', data)
      window.electronAPI.send('browser:batchLaunch', data.map((item: any) => toRaw(item)))
      const proxyResult = await window.electronAPI.send('proxy:detection', toRaw(data[0]))
      console.log('🚀 ~proxyResult:', proxyResult)
      break
    }
    case 'Edit':
      console.log('🚀 ~Edit:', data)
      break
    case 'Delete':
      console.log('🚀 ~Delete:', data)
      break
  }
}

export default {
  sorts,
  operation,
  operationHandler,
}
