export function getFilters(params: any = {}) {
  return [
    {
      label: ' ',
      name: 'match',
      value: params.match ?? 'every',
      options: [
        { label: 'Match Every', value: 'every' },
        { label: 'Match Any', value: 'any' },
      ],
    },
  ]
}

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
        { label: '窗口ID', value: 'id' },
        { label: '窗口名称', value: 'name' },
        { label: '国家', value: 'lastCountry' },
      ],
      icon: 'mdi-sort-descending',
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
      icon: 'mdi-sort-descending',
    },
  ]
}

export function getOperation(_params: any = {}) {
  return [
    {
      name: 'edit',
      label: '编辑',
      icon: 'mdi mdi-pencil-outline',
    },
    {
      separator: true,
    },
    {
      name: 'view',
      label: '预览',
      icon: 'mdi mdi mdi-cube-scan',
      multiple: true,
    },
    {
      name: 'restart',
      label: '重启',
      icon: 'mdi mdi-restart',
      multiple: true,
      groupName: 'first',
    },
    {
      name: 'close',
      label: '关闭',
      icon: 'mdi mdi-power',
      multiple: true,
      groupName: 'first',
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'addGroup',
      label: '新增组',
      icon: 'mdi mdi-home-group',
      multiple: true,
      groupName: 'second',
    },
    {
      name: 'addTag',
      label: '新增标签',
      icon: 'mdi mdi-tag-heart-outline',
      multiple: true,
      groupName: 'second',
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'fav',
      label: '收藏',
      icon: 'mdi mdi-bookmark-music-outline',
      multiple: true,
    },
    {
      name: 'addNotes',
      label: '新增笔记',
      icon: 'mdi mdi-clipboard-list-outline',
      multiple: true,
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'editCookies',
      label: '编辑cookies',
      icon: 'mdi mdi-clipboard-edit-outline',
    },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: '删除',
      icon: 'mdi mdi-delete-empty-outline',
      multiple: true,
    },
  ]
}

export default {
  getFilters,
  getSorts,
  getOperation,
}
