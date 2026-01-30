import { format } from 'date-fns'
import { API } from '/@/api'

import { useRoleStore } from '/@/stores/role'
import { useTeam } from '/@/views/team/hooks'
import { getColumns } from './columns'
import { getDictMap, setInputValueByFormData, transformSortOrder } from '/@/utils'
import type { SortOrderNumber } from '/@/utils'

const role = useRoleStore()
const { getTeamMembers } = useTeam()

export function tableFilters(_params: any = {}) {
  return [
    {
      type: 'select',
      name: 'operateModule',
      value: 'all',
      size: 'xxs',
      disabled: true,
      options: [
        { label: $t('匹配所有'), value: 'all' },
        { label: $t('匹配部分'), value: 'part' },
      ],
    },
  ]
}

export async function getCustomFilters(params: any = {}) {
  const $dict_map = await getDictMap()

  const inputs = [
    {
      type: 'text',
      label: $t('窗口名称'),
      placeholder: $t('请输入窗口名称'),
      name: 'windowName',
      icon: 'base/rx_ic_browser',
    },
    {
      type: 'text',
      label: $t('序号'),
      placeholder: $t('请输入序号(多个用英文逗号分隔)'),
      name: 'sortNums',
      icon: 'base/rx_ic_id',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      label: $t('操作系统'),
      name: 'osList',
      icon: 'base/rx_ic_laptop',
      getOptions: () => {
        return ($dict_map.os || []).map((item: any) => ({
          parentName: 'osList',
          value: item.value,
          label: item.label,
        }))
      },
      formatValue: (input: any) => {
        return input.value?.map((item: any) => item.value)
      },
    },
    {
      type: 'Checkbox',
      name: 'platformUrls',
      label: $t('业务平台'),
      icon: 'base/rx_ic_keys',
      getOptions: async () => {
        const { data } = await API.window.userGetWindowPlatformAccountListList()
        return (data?.rows || []).map((item: any) => {
          const label = new URL(item.platformUrl).hostname.replace(/.*\.(.*?)\..*/, '$1')
          return {
            parentName: 'platformUrls',
            label,
            value: label,
          }
        })
      },
      formatValue: (input: any) => {
        return input.value?.map((item: any) => item.value)
      },
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      name: 'projectIds',
      label: $t('项目'),
      icon: 'base/rx_ic_stack',
      getOptions: async () => {
        // default 2: 查全部包含默认项目
        const { data } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
        return (data.rows || []).map((item: any) => ({
          parentName: 'projectIds',
          value: `${item.project_id}`,
          label: item.projectName,
        }))
      },
      formatValue: (input: any) => {
        return input.value?.map((item: any) => item.value)
      },
    },
    {
      type: 'Checkbox',
      name: 'labelIds',
      label: $t('标签'),
      icon: 'base/rx_ic_tag',
      getOptions: async () => {
        const [{ data: labelList }, { data: memberList }] = await Promise.all([
          await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' }),
          await getTeamMembers(),
        ])

        const menbers = (memberList.rows || []).map((item: any) => ({
          parentName: 'labelIds',
          value: `u_${item.user_id}`,
          label: item.userName,
          avatar: item.avatar,
          avatarColor: item.avatarColor,
        }))

        const labels = (labelList.rows || []).map((item: any) => ({
          parentName: 'labelIds',
          value: `${item.id}`,
          label: item.name,
        }))

        return menbers.concat(labels as any)
      },
      formatValue: (input: any) => {
        return input.value?.map((item: any) => item.value)
      },
    },
    {
      separator: true,
    },
    {
      type: 'switch',
      name: 'isOften',
      label: $t('收藏'),
      _text: ' ',
      icon: 'base/rx_ic_bookmark',
    },
    {
      type: 'textarea',
      label: $t('备注'),
      placeholder: $t('请输入备注'),
      name: 'windowRemark',
      icon: 'base/rx_ic_doc_article',
    },
    {
      type: 'switch',
      name: 'openStatus',
      label: $t('已打开'),
      _text: ' ',
      icon: 'base/rx_ic_browsers_line',
    },
    {
      separator: true,
    },
    {
      type: 'date',
      name: 'createTime',
      icon: 'base/rx_ic_calendar',
      label: $t('创建时间'),
      placeholder: $t('请选择时间'),
      maxDate: new Date(),
      selectionMode: 'range',
      manualInput: false,
      showButtonBar: false,
      dateFormat: 'yy/mm/dd',
      formatValue: (input: any, _: any, formData: any) => {
        const value = input.value
        if (value) {
          value[1] ??= value[0]
          const [startDate, endDate] = value.map((value: Date) => format(new Date(value), 'yyyy-MM-dd'))
          Object.assign(formData, { startDate, endDate })
        }
        return value
      },
    },
    {
      type: 'date',
      name: 'modfiyTime',
      icon: 'base/rx_ic_calendar',
      label: $t('修改时间'),
      placeholder: $t('请选择时间'),
      maxDate: new Date(),
      selectionMode: 'range',
      manualInput: false,
      showButtonBar: false,
      dateFormat: 'yy/mm/dd',
      formatValue: (input: any, _: any, formData: any) => {
        const value = input.value
        if (value) {
          value[1] ??= value[0]
          const [startUpdateDate, endUpdateDate] = value.map((value: Date) => format(new Date(value), 'yyyy-MM-dd'))
          Object.assign(formData, { startUpdateDate, endUpdateDate })
        }
        return value
      },
    },
  ]
  setInputValueByFormData(inputs, {
    ...params,
    createTime: Array.isArray(params.createTime) ? [new Date(params.createTime[0]), new Date(params.createTime[1])] : undefined,
    modfiyTime: Array.isArray(params.modfiyTime) ? [new Date(params.modfiyTime[0]), new Date(params.modfiyTime[1])] : undefined,
  })

  return inputs
}

export async function getSorts() {
  const columns = getColumns()
  const { data } = await API.window.userGetWindowTableSortOrderList()

  const onChange = (data: any) => {
    const params: Record<string, any> = {}
    if (data.sortField && columns.data.find(item => item.key === data.sortField && item.sortable)) {
      params.orderName = data.sortField
      params.orderType = transformSortOrder(data.sortOrder as SortOrderNumber)
    }
    API.window.userSaveWindowTableSortOrderCreate(params as any)
  }

  // 需要处理旧字段，如果字段已经不在我们新版的设计中，那么这个字段就不能传到接口中去
  const isSorField = columns.data.find(item => item.key === data?.orderName && item.sortable)

  return {
    data: {
      sortField: isSorField ? data?.orderName : undefined,
      sortOrder: transformSortOrder(data?.orderType ?? 'desc'),
    },
    onChange,
  }
}

export function getOperation(row: any = {}) {
  return [
    {
      name: 'edit',
      label: $t('编辑窗口'),
      icon: 'base/rx_ic_edit',
      power: !role.isViewer,
    },
    {
      name: 'transfer',
      label: $t('投送窗口'),
      icon: 'base/rx_ic_transfer',
      tooltip: $t('投送窗口'),
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'G3',
        showLabel: true,
      },
      disabled: !(role.isOwner || role.isManager),
      disabledTooltip: $t('权限不足'),
    },
    {
      name: 'moveToProject',
      label: $t('移动到项目'),
      icon: 'base/rx_ic_stack_move',
      multiple: true,
      power: role.isOwner || role.isManager,
    },
    {
      power: !role.isViewer,
      multiple: true,
      separator: true,
    },
    {
      name: 'open',
      label: $t('打开窗口'),
      icon: 'base/rx_ic_chrome',
      multiple: true,
      multipleProps: {
        name: 'G1',
        showLabel: true,
        iconProps: {
          color: 'var(--pattern-actionbar-icon-open)',
        },
      },
    },
    {
      name: 'close',
      label: $t('关闭窗口'),
      icon: 'base/rx_ic_shut_down',
      tooltip: $t('关闭窗口'),
      multiple: true,
      multipleProps: {
        name: 'G2',
        showLabel: true,
      },
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'setAsDefaultBrowser',
      label: $t('设为默认浏览器'),
      icon: 'base/rx_ic_loptop_check',
      suffixIcon: 'base/fire',
    },
    {
      name: 'createDesktopShortcut',
      label: $t('创建桌面快捷方式'),
      icon: 'base/rx_ic_show_profile_2',
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'profileActions',
      label: $t('窗口操作'),
      icon: 'base/rx_ic_browser',
      multiple: true,
      items: [
        {
          name: 'view',
          label: $t('查看窗口'),
          icon: 'base/rx_ic_browser',
          multiple: false,
        },
        {
          name: 'restart',
          label: $t('重启窗口'),
          icon: 'base/rx_ic_refresh',
          tooltip: $t('重启窗口'),
        },

        {
          name: 'copyId',
          label: $t('复制窗口 ID'),
          power: !role.isViewer,
          icon: 'base/rx_ic_copy',
          multiple: false,
        },
        {
          name: 'exportProfile',
          label: $t('导出窗口'),
          icon: 'base/rx_ic_export',
          power: !role.isViewer,
        },
      ],
    },
    {
      name: 'proxyActions',
      label: $t('代理 IP 操作'),
      icon: 'base/rx_ic_internet',
      multiple: true,
      power: !role.isViewer,
      items: [
        {
          name: 'addProxy',
          label: $t('添加代理 IP'),
          icon: 'base/rx_ic_plus',
        },
        {
          name: 'chooseProxy',
          label: $t('选择已有代理 IP'),
          icon: 'base/rx_ic_exchange',
        },
        {
          name: 'deleteProxy',
          label: $t('删除代理 IP'),
          icon: 'base/rx_ic_bin_1',
          disabled: !([].concat(row).some((item: any) => item.proxyCategory !== 'noproxy')),
        },
      ],
    },
    {
      name: 'platformAccountActions',
      label: $t('平台账号操作'),
      icon: 'base/rx_ic_keys',
      multiple: true,
      power: !role.isViewer,
      items: [
        {
          name: 'addPlatformAccount',
          label: $t('添加平台账号'),
          icon: 'base/rx_ic_plus',
        },
        {
          name: 'choosePlatformAccount',
          label: $t('选择已有平台账号'),
          icon: 'base/rx_ic_exchange',
        },
      ],
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'addNotes',
      label: $t('添加备注'),
      icon: 'base/rx_ic_doc_add',
      multiple: true,
    },
    {
      name: 'addTag',
      label: $t('添加标签'),
      icon: 'base/rx_ic_tag',
      power: !role.isViewer,
      multiple: true,
    },
    {
      power: !role.isViewer,
      separator: true,
      multiple: true,
    },
    {
      name: 'editCookies',
      label: $t('编辑 Cookies'),
      icon: 'base/rx_ic_cookies',
      power: !role.isViewer,
      multiple: true,
    },
    {
      power: !role.isViewer,
      separator: true,
    },
    {
      name: 'clearCache',
      label: $t('清除缓存'),
      icon: 'base/rx_ic_brush',
      power: !role.isViewer,
      multiple: true,
    },
    {
      power: !role.isViewer,
      separator: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: $t('删除窗口'),
      icon: 'base/rx_ic_bin_1',
      power: !role.isViewer,
      multiple: true,
    },
  ]
}

export function getAdvancedSearch() {
  return [
    {
      key: 'name',
      label: $t('窗口名称'),
      icon: 'base/rx_ic_browser',
      syntax: 'name::',
    },
    {
      key: 'remark',
      label: $t('备注'),
      icon: 'base/rx_ic_doc_article',
      syntax: 'note::',
    },
    {
      key: 'account',
      label: $t('平台账号'),
      icon: 'base/rx_ic_keys',
      syntax: 'account::',
    },
    {
      key: 'proxy',
      label: $t('代理 IP'),
      icon: 'base/rx_ic_internet',
      syntax: 'proxy::',
    },
    {
      key: 'tag',
      label: $t('标签'),
      icon: 'base/rx_ic_tag',
      syntax: 'tag::',
    },
    {
      key: 'project_name',
      label: $t('项目'),
      icon: 'base/rx_ic_stack',
      syntax: 'project::',
    },
    {
      key: 'sortNum',
      label: 'ID',
      icon: 'base/rx_ic_id',
      syntax: 'id::',
    },
    {
      key: 'os',
      label: $t('操作系统'),
      icon: 'base/rx_ic_laptop',
      syntax: 'system::',
    },
    {
      key: 'coreVersion',
      label: $t('内核版本'),
      icon: 'base/rx_ic_chrome',
      syntax: 'kernel::',
    },
  ]
}

export default {
  tableFilters,
  getCustomFilters,
  getSorts,
  getOperation,
  getAdvancedSearch,
}
