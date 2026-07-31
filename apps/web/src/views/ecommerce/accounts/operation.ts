import { format } from 'date-fns'
import { API } from '/@/api'
import { useTeamStore } from '/@/stores/team'
import { usePermission } from '/@/hooks/usePermission'
import { getAccountColumns } from './columns'
import { getDictMap, setInputValueByFormData, transformSortOrder } from '/@/utils'
import type { SortOrderNumber } from '/@/utils'
import { CoreType } from '/@/enums'

const { getTeamMembers } = useTeamStore()
const { check } = usePermission()

export async function getAccountFilters(params: any = {}) {
  const $dict_map = await getDictMap()

  const inputs = [
    {
      type: 'text',
      label: $t('账号名称'),
      placeholder: $t('请输入账号名称'),
      name: 'windowName',
      icon: 'base/rx_ic_browser',
    },
    {
      type: 'text',
      label: $t('编号'),
      placeholder: $t('请输入编号(多个用英文逗号分隔)'),
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
      name: 'coreType',
      label: $t('内核'),
      icon: 'base/rx_ic_chrome',
      getOptions: async () => {
        return [
          {
            parentName: 'coreType',
            label: 'Chrome',
            value: CoreType.Chrome,
          },
          {
            parentName: 'coreType',
            label: 'Firefox',
            value: CoreType.Firefox,
          },
        ]
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
      label: $t('分组'),
      icon: 'base/rx_ic_stack',
      getOptions: async () => {
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
          value: `u_${item.userId}`,
          label: item.workspaceNickname || item.userName,
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
      name: 'openStatus',
      label: $t('已打开'),
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

export async function getAccountSorts() {
  const columns = getAccountColumns()
  const { data } = await API.window.userGetWindowTableSortOrderList()

  const onChange = (data: any) => {
    const params: Record<string, any> = {}
    if (data.sortField && columns.data.some(item => item.key === data.sortField && item.sortable)) {
      params.orderName = data.sortField
      params.orderType = transformSortOrder(data.sortOrder as SortOrderNumber)
    }
    API.window.userSaveWindowTableSortOrderCreate(params as any)
  }

  const isSorField = columns.data.find(item => item.key === data?.orderName && item.sortable)

  return {
    data: {
      sortField: isSorField ? data?.orderName : undefined,
      sortOrder: transformSortOrder(data?.orderType ?? 'desc'),
    },
    onChange,
  }
}

export function getAccountOperation(row: any = {}) {
  const hasBindProxy = [].concat(row).some((item: any) => item.proxyCategory !== 'noproxy')

  return [
    {
      name: 'edit',
      label: $t('编辑账号'),
      icon: 'base/rx_ic_edit',
      power: check('Profiles_edit'),
    },
    // {
    //   name: 'transfer',
    //   label: $t('转移账号'),
    //   icon: 'base/rx_ic_transfer',
    //   tooltip: $t('转移账号'),
    //   multiple: true,
    //   power: check('Profiles_transfer_window'),
    // },
    {
      name: 'moveToProject',
      label: $t('移动到分组'),
      icon: 'base/rx_ic_stack_move',
      multiple: true,
      power: check('Profiles_move_project'),
    },
    {
      power: check(['Profiles_edit', 'Profiles_transfer_window', 'Profiles_move_project'], 'any'),
      multiple: true,
      separator: true,
    },
    {
      name: 'open',
      label: $t('打开账号'),
      icon: row.coreType === CoreType.Firefox ? 'base/rx_ic_firefox' : 'base/rx_ic_chrome',
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
      label: $t('关闭账号'),
      icon: 'base/rx_ic_shut_down',
      tooltip: $t('关闭账号'),
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
      label: $t('账号操作'),
      icon: 'base/rx_ic_browser',
      multiple: true,
      power: check(['Profiles_copy_window_id', 'Profiles_export_window'], 'any'),
      items: [
        {
          name: 'view',
          label: $t('查看账号'),
          icon: 'base/rx_ic_browser',
          multiple: false,
        },
        {
          name: 'restart',
          label: $t('重启账号'),
          icon: 'base/rx_ic_refresh',
          tooltip: $t('重启账号'),
        },
        {
          name: 'copyId',
          label: $t('复制账号 ID'),
          power: check('Profiles_copy_window_id'),
          icon: 'base/rx_ic_copy',
          multiple: false,
        },
        {
          name: 'exportProfile',
          label: $t('导出账号'),
          icon: 'base/rx_ic_export',
          power: check('Profiles_export_window'),
        },
      ],
    },
    {
      name: 'proxyActions',
      label: $t('设备操作'),
      icon: 'base/rx_ic_internet',
      multiple: true,
      power: check(['Profiles_select_proxy', 'Profiles_speed_test_proxy'], 'any'),
      items: [
        {
          name: 'chooseProxy',
          label: $t('选择设备'),
          icon: 'base/rx_ic_exchange',
          power: check('Profiles_select_proxy'),
          multiple: false,
        },
        {
          name: 'checkProxy',
          label: $t('测试设备'),
          icon: 'base/rx_ic_speed_test',
          tooltip: hasBindProxy ? $t('测试设备') : $t('未绑定设备'),
          power: check('Profiles_speed_test_proxy'),
          disabled: !hasBindProxy,
        },
      ],
    },
    {
      power: check(['Profiles_copy_window_id', 'Profiles_export_window', 'Profiles_select_proxy', 'Profiles_speed_test_proxy'], 'any'),
      separator: true,
      multiple: true,
    },
    {
      name: 'addTag',
      label: $t('添加标签'),
      icon: 'base/rx_ic_tag',
      power: check(['Profiles_Label_add', 'Profiles_select_label']),
      multiple: true,
    },
    {
      power: check(['Profiles_Label_add', 'Profiles_select_label'], 'any'),
      separator: true,
      multiple: true,
    },
    {
      name: 'editCookies',
      label: $t('编辑 Cookies'),
      icon: 'base/rx_ic_cookies',
      power: check('Profiles_edit_cookies'),
      multiple: true,
    },
    {
      name: 'cookieRobot',
      label: $t('Cookie 机器人'),
      icon: 'base/rx_ic_cookie_bot',
      suffixIcon: 'base/fire',
      menuTooltip: $t('自动模拟浏览行为，生成真实 Cookie，适用于养号、账号预热，降低账号风控风险'),
      multiple: true,
    },
    {
      power: check('Profiles_clear_cache'),
      separator: true,
    },
    {
      name: 'clearCache',
      label: $t('清除缓存'),
      icon: 'base/rx_ic_brush',
      power: check('Profiles_clear_cache'),
      multiple: true,
    },
    {
      power: check('Profiles_delete'),
      separator: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: $t('删除账号'),
      icon: 'base/rx_ic_bin_1',
      power: check('Profiles_delete'),
      multiple: true,
    },
  ]
}

export function getAccountAdvancedSearch() {
  return [
    {
      key: 'name',
      label: $t('账号名称'),
      icon: 'base/rx_ic_browser',
      syntax: 'name::',
    },
    {
      key: 'proxy',
      label: $t('设备'),
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
      label: $t('分组'),
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
