export const operation = [
  {
    key: 'test',
    name: '测试',
    quick: true,
  },
  {
    key: 'Edit',
    name: '编辑',
  },
  {
    key: 'Delete',
    name: '删除',
  },
]

export const sorts = [
  {
    key: 'city',
    name: '城市',
    placeholder: '请选择城市',
    value: null,
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
    key: 'order',
    name: '排序',
    placeholder: '请选择排序',
    value: null,
    icon: 'mdi-sort-descending',
    options: [
      { label: '升序', value: 'NY' },
      { label: '降序', value: 'RM' },
    ],
  },
  {
    key: 'time',
    name: '时间',
    placeholder: '请选择时间',
    value: null,
    icon: 'mdi-sort-descending',
    options: [
      { label: '创建时间', value: 'create' },
      { label: '修改时间', value: 'modify' },
    ],
  },
]

export function operationHandler({ key }: any, data: any) {
  switch (key) {
    case 'test':
      console.log('🚀 ~test:', data)
      break
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
