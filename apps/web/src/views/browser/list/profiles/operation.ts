import { format } from 'date-fns'
import { API } from '/@/api'

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
        { label: '窗口序号', value: 'windowSortNum' },
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
      label: '新增组 x',
      icon: 'mdi mdi-home-group',
      multiple: true,
      groupName: 'second',
    },
    {
      name: 'addTag',
      label: '新增标签 x',
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
      label: '编辑cookies x',
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

export async function getCustomFilters(params: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  // todo 下版本优化，点击二级菜单才调用接口
  const [{ data: platformList }, { data: groupList }, { data: labelList }] = await Promise.all([
    API.platform.userGetPlatformInfoV2List({ page_index: 1, page_size: 999 }),
    API.window.userGetGroupInfoList({ page_index: 1, page_size: 999 }),
    API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' }),
  ])

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
      type: 'Checkbox',
      name: 'platformUrlIds',
      label: '账号平台',
      icon: 'mdi mdi-abjad-hebrew',
      options: platformList.rows.map((item: any) => ({
        parentLabel: '账号平台',
        parentName: 'platformUrlIds',
        value: `${item.id}`,
        label: item.platformName,
      })),
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      name: 'openStatus',
      label: '窗口状态',
      options: [
        {
          icon: 'mdi mdi-home-group',
          label: '窗口打开',
          value: true,
        },
        {
          icon: 'mdi mdi-home-group',
          label: '窗口关闭',
          value: false,
        },
      ],
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      name: 'groupIds',
      label: '窗口分组',
      icon: 'mdi mdi-access-point-check',
      options: groupList.rows.map((item: any) => ({
        parentLabel: '窗口分组',
        parentName: 'groupIds',
        value: `${item.id}`,
        label: item.name,
      })),
    },
    {
      type: 'Checkbox',
      name: 'labelIds',
      label: '窗口标签',
      icon: 'mdi mdi-tag-heart-outline',
      options: labelList.rows.map((item: any) => ({
        parentLabel: '窗口分组',
        parentName: 'labelIds',
        value: `${item.id}`,
        label: item.name,
      })),
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
      type: 'text',
      label: '关联代理ID',
      name: 'proxyIds',
      placeholder: '多个代理ID逗号分隔',
      icon: 'mdi mdi-abacus',
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
      label: '检测状态',
      options: [
        {
          icon: 'mdi mdi-clipboard-edit-outline',
          label: '检测成功的代理',
          value: '1',
        },
        {
          icon: 'mdi mdi-account-card-outline',
          label: '检测失败的代理',
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
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: '请选择结束时间',
          name: 'endDate',
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
      ],
    },
  ].map((input: any) => {
    if (input.type === 'date') {
      input.value = params.startDate && params.endDate ? [params.startDate, params.endDate].join('~') : undefined
      input.items.forEach((it: any) => it.value = params[it.name])
    }
    else {
      input.value = params[input.name]
    }
    return input
  })
}

export default {
  getFilters,
  getSorts,
  getOperation,
}
