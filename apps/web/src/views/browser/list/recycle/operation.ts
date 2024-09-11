export function getOperation() {
  return [
    {
      name: 'recover',
      label: '恢复',
      icon: 'mdi mdi-refresh',
      classes: 'text-gray-500',
      quick: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: '删除',
      icon: 'mdi mdi-delete-empty-outline',
      classes: 'text-red',
      quick: true,
      multiple: true,
    },
  ]
}

export default {
  getOperation,
}
