import { format } from 'date-fns'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { getDictMap, getFormData, setInputValueByFormData } from '/@/utils'

const role = useRoleStore()

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
      name: 'platformUrlIds',
      label: $t('业务平台'),
      icon: 'base/rx_ic_keys',
      getOptions: async () => {
        const { data } = await API.platform.userGetPlatformInfoV2List({ page_index: 1, page_size: 999 })
        return (data.rows || []).map((item: any) => ({
          parentName: 'platformUrlIds',
          value: `${item.id}`,
          label: new URL(item.platformUrl).hostname.replace(/.*\.(.*?)\..*/, '$1'),
        }))
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
          await API.team.userGetMemberInfoByWorkspaceList({}),
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
  const { data } = await API.window.userGetWindowTableSortOrderList()

  const list = [
    {
      label: $t('排序标准'),
      name: 'orderName',
      value: data?.orderName ?? 'windowSortNum',
      defaultValue: 'windowSortNum',
      options: [
        { label: $t('序号'), value: 'windowSortNum' },
        { label: $t('名称'), value: 'name' },
        { label: $t('创建时间'), value: 'createTime' },
        { label: $t('修改时间'), value: 'updateTime' },
        { label: $t('最后打开时间'), value: 'openTime' },
        { label: $t('最后关闭时间'), value: 'closeTime' },
      ],
      icon: 'base/rx_ic_sort_a2z',
    },
    {
      label: $t('排序方式'),
      name: 'orderType',
      value: data?.orderType ?? 'desc',
      defaultValue: 'desc',
      options: [
        { label: $t('倒序'), value: 'desc' },
        { label: $t('正序'), value: 'asc' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
  ]

  const onChange = () => {
    API.window.userSaveWindowTableSortOrderCreate(getFormData(list))
  }

  return {
    data: list,
    onChange,
  }
}

export function getOperation(_params: any = {}) {
  return [
    {
      name: 'edit',
      label: $t('编辑窗口'),
      icon: 'base/rx_ic_edit',
      power: !role.isViewer,
    },
    {
      name: 'transfer',
      label: $t('转移窗口'),
      icon: 'base/rx_ic_transfer',
      tooltip: $t('转移窗口'),
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'G3',
        showLabel: true,
      },
      power: role.isOwner || role.isManager,
    },
    {
      name: 'moveToProject',
      label: $t('移动到项目'),
      icon: 'base/rx_ic_stack',
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
      label: $t('打开'),
      icon: 'base/rx_ic_chrome',
      multiple: true,
      multipleProps: {
        name: 'G1',
        showLabel: true,
        iconProps: {
          color: '#12A3FC',
        },
      },
    },
    {
      name: 'view',
      label: $t('查看窗口'),
      icon: 'base/rx_ic_browser',
    },
    {
      name: 'restart',
      label: $t('重启窗口'),
      icon: 'base/rx_ic_refresh',
      tooltip: $t('重启窗口'),
      multiple: true,
      multipleProps: {
        name: 'G2',
        showLabel: true,
      },
    },
    {
      name: 'close',
      label: $t('关闭窗口'),
      icon: 'base/rx_ic_shut_down',
      tooltip: $t('关闭窗口'),
      multiple: true,
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
    },
    {
      name: 'editCookies',
      label: $t('编辑 Cookies'),
      icon: 'base/rx_ic_cookies',
      power: !role.isViewer,
    },
    {
      name: 'copyId',
      label: $t('复制窗口 ID'),
      power: !role.isViewer,
      icon: 'base/rx_ic_copy',
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
    },
    {
      name: 'exportProfile',
      label: $t('导出窗口'),
      icon: 'base/rx_ic_export',
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

export default {
  tableFilters,
  getCustomFilters,
  getSorts,
  getOperation,
}
