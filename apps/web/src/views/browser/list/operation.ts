export const operation = [
  {
    name: "edit",
    label: "编辑",
    icon: "mdi mdi-pencil-outline",
    extraProps: {
      multiple: false,
    },
    command: () => {},
  },
  {
    separator: true,
    extraProps: {
      multiple: false,
    },
  },
  {
    name: "view",
    label: "预览",
    icon: "mdi mdi mdi-cube-scan",
    command: () => {},
  },
  {
    name: "restart",
    label: "重启",
    icon: "mdi mdi-restart",
    command: () => {},
  },
  {
    name: "close",
    label: "关闭",
    icon: "mdi mdi-power",
    command: () => {},
  },
  {
    separator: true,
  },
  {
    name: "addGroup",
    label: "新增组",
    icon: "mdi mdi-home-group",
    command: () => {},
  },
  {
    name: "addTag",
    label: "新增标签",
    icon: "mdi mdi-tag-heart-outline",
    command: () => {},
  },
  {
    separator: true,
  },
  {
    name: "fav",
    label: "收藏",
    icon: "mdi mdi-bookmark-music-outline",
    command: () => {},
  },
  {
    name: "addNotes",
    label: "新增笔记",
    icon: "mdi mdi-clipboard-list-outline",
    command: () => {},
  },
  {
    separator: true,
  },
  {
    name: "editCookies",
    label: "编辑cookies",
    icon: "mdi mdi-clipboard-edit-outline",
    extraProps: {
      multiple: false,
    },
    command: () => {},
  },
  {
    separator: true,
    extraProps: {
      multiple: false,
    },
  },
  {
    name: "delete",
    label: "删除",
    icon: "mdi mdi-delete-empty-outline",
    command: () => {},
  },
];

export const sorts = [
  {
    label: "城市",
    name: "city",
    value: null,
    placeholder: "请选择城市",
    icon: "mdi-sort-descending",
    options: [
      { label: "New York", value: "NY" },
      { label: "Rome", value: "RM" },
      { label: "London", value: "LDN" },
      { label: "Istanbul", value: "IST" },
      { label: "Paris", value: "PRS" },
    ],
  },
  {
    label: "排序",
    name: "order",
    value: null,
    placeholder: "请选择排序",
    icon: "mdi-sort-descending",
    options: [
      { label: "升序", value: "NY" },
      { label: "降序", value: "RM" },
    ],
  },
  {
    name: "time",
    label: "时间",
    placeholder: "请选择时间",
    value: null,
    icon: "mdi-sort-descending",
    options: [
      { label: "创建时间", value: "create" },
      { label: "修改时间", value: "modify" },
    ],
  },
];

export const filters = [
  {
    label: "city",
    name: "city",
    value: null,
    placeholder: "筛选",
    options: [
      { label: "北京", value: "bj" },
      { label: "上海", value: "sh" },
      { label: "广州", value: "gz" },
      { label: "深圳", value: "sz" },
      { label: "杭州", value: "hz" },
    ],
  },
  {
    label: "city2",
    name: "city2",
    value: null,
    placeholder: "筛选2",
    options: [
      { label: "北京", value: "bj" },
      { label: "上海", value: "sh" },
      { label: "广州", value: "gz" },
      { label: "深圳", value: "sz" },
      { label: "杭州", value: "hz" },
    ],
  },
];

export default {
  sorts,
  operation,
};
