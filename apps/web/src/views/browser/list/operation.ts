import { format } from 'date-fns'

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
      label: 'view',
      icon: 'mdi mdi mdi-cube-scan',
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

export function getCustomFilters(params: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  return [
    {
      type: 'text',
      name: 'windowName',
      label: '窗口名称',
      icon: 'mdi mdi-ab-testing',
    },
    {
      type: 'number',
      label: '窗口序号',
      name: 'sortNums',
      icon: 'mdi mdi-abacus',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      label: '操作系统',
      name: 'osList',
      icon: 'mdi mdi-abjad-arabic',
      options: ($dict_map.os || []).map((item: any) => ({
        parentLabel: '操作系统',
        parentName: 'osList',
        value: item.value,
        label: item.label,
      })),
    },
    {
      name: 'platformUrlIds',
      label: '#@账号平台(多选)',
      icon: 'mdi mdi-abjad-hebrew',
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      name: 'openStatus',
      options: [
        {
          name: 'statusOpen',
          label: '窗口打开',
          value: true,
          icon: 'mdi mdi-home-group',
        },
        {
          name: 'statusClose',
          label: '窗口关闭',
          value: false,
          icon: 'mdi mdi-home-group',
        },
      ],
    },
    {
      separator: true,
    },
    {
      name: 'groupIds',
      label: '#@窗口分组(多选)',
      icon: 'mdi mdi-access-point-check',
    },
    {
      name: 'labelIds',
      label: '#@窗口标签(多选)',
      icon: 'mdi mdi-tag-heart-outline',
    },
    {
      separator: true,
    },
    {
      type: 'switch',
      name: 'isOften',
      label: '窗口收藏',
      icon: 'mdi mdi-bookmark-music-outline',
    },
    {
      type: 'textarea',
      label: '窗口备注',
      name: 'windowRemark',
      icon: 'mdi mdi-clipboard-list-outline',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      name: 'proxyProtocoList',
      label: '代理协议',
      icon: 'mdi mdi-alarm-check',
      options: ($dict_map.protocol || []).map((item: any) => ({
        parentLabel: '代理协议',
        parentName: 'proxyProtocoList',
        value: item.value,
        label: item.label,
      })),
    },

    {
      type: 'radio',
      name: 'proxyTestStatus',
      options: [
        {
          name: 'statusSuccess',
          label: '检测成功的代理',
          icon: 'mdi mdi-clipboard-edit-outline',
          value: '1',
        },
        {
          name: 'statusFailure',
          label: '检测失败的代理',
          icon: 'mdi mdi-account-card-outline',
          value: '2',
        },
      ],
    },
    {
      separator: true,
    },
    {
      type: 'date',
      name: 'createTime',
      label: '窗口创建时间',
      icon: 'mdi mdi-delete-empty-outline',
      items: [
        {
          placeholder: '请选择开始时间',
          name: 'startDate',
          formatValue: (self: any) => {
            return self.valu && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: '请选择结束时间',
          name: 'endDate',
          formatValue: (self: any) => {
            return self.valu && format(self.value, 'yyyy-MM-dd')
          },
        },
      ],
    },
  ].map((input: any) => {
    input.value = params[input.name]
    return input
  })
}

export default {
  getFilters,
  getSorts,
  getOperation,
}
