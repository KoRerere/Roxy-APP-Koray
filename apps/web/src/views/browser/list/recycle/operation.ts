export function getSorts(params: any = {}) {
  return [
    {
      label: '排序规则',
      placeholder: '请选择排序规则',
      name: 'orderName',
      value: params.orderName ?? 'createTime',
      options: [
        { label: '创建时间', value: 'createTime' },
        { label: '修改时间', value: 'updateTime' },
        { label: '最后打开时间', value: 'openTime' },
        { label: '最后关闭时间', value: 'closeTime' },
        { label: '代理检测时间', value: 'checkTime' },
        { label: '窗口序号', value: 'windowSortNum' },
        { label: '窗口名称', value: 'name' },
        { label: '国家', value: 'lastCountry' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
    {
      label: '排序类型',
      placeholder: '请选择排序类型',
      name: 'orderType',
      value: params.orderType ?? 'desc',
      options: [
        { label: '降序', value: 'desc' },
        { label: '升序', value: 'asc' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
  ]
}

export function getOperation() {
  return [
    {
      name: 'recover',
      label: '恢复',
      icon: 'base/rx_ic_refresh',
      classes: 'text-gray-500',
      quick: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: '删除',
      icon: 'base/rx_ic_bin_1',
      classes: 'text-red',
      quick: true,
      multiple: true,
    },
  ]
}

export default {
  getSorts,
  getOperation,
}
