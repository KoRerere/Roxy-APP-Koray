import { API } from "/@/api";
import { getFormDataByList } from "/@/utils";

function setInputVisible(
  inputs: any[],
  names: string | string[],
  state: boolean,
) {
  const _names: string[] = ([] as string[]).concat(names);
  inputs.forEach((item: any) => {
    if (_names.includes(item.name)) {
      item.visible = state;
    }
  });
}

async function getUaWebgl(windowInputs: any) {
  const { os, osVersion, coreVersion } = getFormDataByList(windowInputs);
  const { data } = await API.window.userGetUaWebglList({
    os,
    osVersion,
    coreVersion,
  });

  const keys = Object.keys(data);

  windowInputs.forEach((inputs: any) => {
    inputs.forEach((input: any) => {
      if (keys.includes(input.name)) {
        input.value = data[input.name];
      }
    });
  });
}

async function getDeviceName(windowInputs: any) {
  const { os } = getFormDataByList(windowInputs);
  return API.window.userGetDeviceNameList({ os });
}

async function getMacAddr(windowInputs: any) {
  // const { os } = getFormDataByList(windowInputs)
  // return API.window.userGetMacAddrV2List({ os })
}

export function getInputs(_data?: any) {
  const $dict_map = JSON.parse(localStorage.getItem("$dict_map") ?? "{}");
  // console.log('🚀 ~ getInputs ~  $dict_map:', $dict_map)

  const windowInputs = reactive([
    [
      {
        label: "系统选择",
        slot: "System",
        items: [
          {
            type: "select",
            name: "os",
            placeholder: "请选择系统",
            value: $dict_map.os[0].value,
            options: $dict_map.os,
            change(self: any, items: any) {
              const osVersionInput = items.find(
                (item: any) => item.name === "osVersion",
              );
              if (self.value) {
                const osVersionOptions = $dict_map[`osVersion-${self.value}`];
                osVersionInput.value = osVersionOptions[0].value;
                osVersionInput.options = osVersionOptions;
                osVersionInput.disabled = false;
              } else {
                osVersionInput.value = null;
                osVersionInput.options = [];
                osVersionInput.disabled = true;
              }
            },
          },
          {
            type: "select",
            name: "osVersion",
            placeholder: "请选择版本",
            value: $dict_map["osVersion-Windows"][0].value,
            options: $dict_map["osVersion-Windows"],
          },
        ],
      },
      {
        type: "select",
        label: "浏览器内核",
        name: "coreVersion",
        placeholder: "请选择浏览器内核",
        value: $dict_map.coreVersion[0],
        options: $dict_map.coreVersion,
      },
      {
        type: "textarea",
        label: "User-Agent",
        name: "userAgent",
        value: "",
        placeholder: "placeholder",
        icon: "mdi mdi-shuffle-variant",
        iconClick: () => {
          getUaWebgl(windowInputs);
        },
      },
      {
        separator: true,
      },
      {
        label: "Proxy(Direct)",
        name: "_proxy",
        value: {
          host: null, // 代理主机
          ipType: null, // 网络协议
          port: null, // 代理端口
          proxyCategory: null, // 代理类型
          proxyPassword: null, // 代理密码
          proxyUserName: null, // 代理账号
          refreshUrl: null, // 刷新URL
        },
        slot: "proxy",
        formatValue: (self: any, _inputs: any, formData: any) => {
          Object.assign(formData, self.value);
        },
      },
      {
        separator: true,
      },
      {
        label: "Accounts",
        name: "windowPlatformList",
        value: [],
        slot: "accounts",
      },
      {
        label: "URLs",
        name: "defaultOpenUrl",
        value: [],
        slot: "urls",
        tooltip: "man!",
      },
      {
        type: "textarea",
        label: "#xCookies",
        name: "cookies",
        value: "",
        placeholder: "Paste your cookies with JSON format",
        icon: "mdi mdi-paperclip",
        formatValue: (self: any) => {
          return self.value;
          // ? JSON.parse(self.value).map(({ name, value, domain }) => ({ name, value, domain }))
          // : value
        },
        onBlur(self: any) {
          console.log("🚀 ~ onBlur ~ self:", self);
        },
      },
    ],
    [
      {
        type: "radio",
        label: "语言",
        name: "isLanguageBaseIp",
        value: true,
        options: [
          { label: "跟随ip匹配", value: true },
          { label: "自定义", value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "language", self.value === false);
        },
      },
      {
        type: "select",
        label: " ",
        name: "language",
        placeholder: "请选择语言",
        value: "",
        options: $dict_map.language,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: "radio",
        label: "语言界面",
        name: "isDisplayLanguageBaseIp",
        value: true,
        options: [
          { label: "跟随ip匹配", value: true },
          { label: "自定义", value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "displayLanguage", self.value === false);
        },
      },
      {
        type: "select",
        label: " ",
        name: "displayLanguage",
        placeholder: "请选择语言",
        value: "",
        options: $dict_map.language,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: "radio",
        label: "时区",
        name: "isTimeZone",
        value: true,
        options: [
          { label: "跟随ip匹配", value: true },
          { label: "自定义", value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "timeZone", self.value === false);
        },
      },
      {
        type: "select",
        label: " ",
        name: "timeZone",
        placeholder: "请选择时区",
        value: "",
        options: $dict_map.timeZone,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: "radio",
        label: "地理位置提示",
        name: "position",
        value: 0,
        options: [
          { label: "询问", value: 0 },
          { label: "允许", value: 1 },
          { label: "禁用", value: 2 },
        ],
        change(_v: any, self: any, inputs: any) {
          const ipt = inputs.find(
            (ipt: any) => ipt.name === "isPositionBaseIp",
          );
          if (ipt) {
            const visible = self.value !== 2;
            ipt.visible = visible;
            if (!visible) {
              ipt.value = true;
              ipt.change(ipt.value, ipt, inputs);
            }
          }
        },
      },
      {
        type: "radio",
        label: "地理位置",
        name: "isPositionBaseIp",
        value: true,
        options: [
          { label: "跟随ip匹配", value: true },
          { label: "自定义", value: false },
        ],
        visible: true,
        change(_v: any, self: any, inputs: any) {
          setInputVisible(
            inputs,
            ["longitude", "latitude", "precisionPos"],
            self.value === false,
          );
        },
      },
      {
        type: "text",
        label: "经度",
        name: "longitude",
        value: "",
        placeholder: "请填写经度, 示例: -40.123",
        visible: false,
      },
      {
        type: "text",
        label: "纬度",
        name: "latitude",
        value: "",
        placeholder: "请填写纬度, 示例: 30.123",
        visible: false,
      },
      {
        type: "text",
        label: "精度(米)",
        name: "precisionPos",
        value: "",
        placeholder: "请填写精度, 范围: 10-5000",
        visible: false,
      },
      {
        type: "radio",
        label: "声音",
        name: "forbidAudio",
        value: true,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "图片",
        name: "forbidImage",
        value: 1,
        options: [
          { label: "加载", value: 1 },
          { label: "禁止", value: 2 },
        ],
      },
      {
        type: "radio",
        label: "视频",
        name: "forbidMedia",
        value: true,
        options: [
          { label: "允许", value: true },
          { label: "禁止", value: false },
        ],
      },
      {
        label: "窗口大小",
        slot: "windowSize",
        items: [
          {
            type: "text",
            name: "openWidth",
            placeholder: "请输入宽度",
          },
          {
            type: "text",
            name: "openHeight",
            placeholder: "请输入高度",
          },
        ],
      },
    ],
    [
      {
        type: "radio",
        label: "分辨率",
        name: "resolutionType",
        value: false,
        options: [
          { label: "跟随电脑", value: false },
          { label: "自定义", value: true },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "resolution", self.value === true);
        },
      },
      {
        type: "select",
        label: "分辨率值",
        name: "resolution",
        placeholder: "请选择分辨率",
        value: "",
        options: $dict_map.resolution,
        virtualScrollerOptions: { itemSize: 38 },
        visible: false,
      },
      {
        type: "radio",
        label: "字体指纹",
        name: "fontType",
        value: true,
        options: [
          { label: "随机", value: true },
          { label: "系统默认", value: false },
        ],
      },
      {
        type: "radio",
        label: "WebRTC",
        name: "webRTC",
        value: 0,
        options: [
          { label: "替换", value: 0 },
          { label: "真实", value: 1 },
          { label: "禁止", value: 2 },
        ],
      },
      {
        type: "radio",
        label: "WebGL图像",
        name: "webGL",
        value: true,
        options: [
          { label: "随机", value: true },
          { label: "真实", value: false },
        ],
      },
      {
        type: "radio",
        label: "WebGL Info",
        name: "webGLInfo",
        value: false,
        options: [
          { label: "真实", value: true },
          { label: "自定义", value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(
            inputs,
            ["webGLManufacturer", "webGLRender"],
            self.value === false,
          );
        },
      },
      {
        type: "text",
        label: "WebGL厂商",
        name: "webGLManufacturer",
        value: "",
        placeholder: "",
        icon: "mdi mdi-shuffle-variant",
        visible: true,
        iconClick: () => {
          getUaWebgl(windowInputs);
        },
      },
      {
        type: "textarea",
        label: "WebGL渲染",
        name: "webGLRender",
        value: "",
        placeholder: "",
        rows: 3,
        icon: "mdi mdi-shuffle-variant",
        visible: true,
        iconClick: () => {
          getUaWebgl(windowInputs);
        },
      },
      {
        type: "radio",
        label: "WebGpu",
        name: "webGpu",
        value: "webgl",
        options: [
          { label: "基于WebGL匹配", value: "webgl" },
          { label: "真实", value: "real" },
          { label: "禁用", value: "block" },
        ],
      },
      {
        type: "radio",
        label: "canvas",
        name: "canvas",
        value: true,
        options: [
          { label: "随机", value: true },
          { label: "真实", value: false },
        ],
      },
      {
        type: "radio",
        label: "AudioContext",
        name: "audioContext",
        value: true,
        options: [
          { label: "随机", value: true },
          { label: "真实", value: false },
        ],
      },
      {
        type: "radio",
        label: "Speech Voices",
        name: "speechVoices",
        value: true,
        options: [
          { label: "随机", value: true },
          { label: "真实", value: false },
        ],
      },
      {
        type: "radio",
        label: "Do Not Track",
        name: "doNotTrack",
        value: true,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "ClientRects",
        name: "clientRects",
        value: true,
        options: [
          { label: "随机", value: true },
          { label: "真实", value: false },
        ],
      },
      {
        type: "radio",
        label: "媒体设备",
        name: "deviceInfo",
        value: true,
        options: [
          { label: "随机", value: true },
          { label: "真实", value: false },
        ],
      },
      {
        type: "radio",
        label: "设备名称",
        name: "deviceNameSwitch",
        value: false,
        options: [
          { label: "随机", value: false },
          { label: "真实", value: true },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "deviceName", self.value === false);
        },
      },
      {
        type: "text",
        label: " ",
        name: "deviceName",
        value: "",
        placeholder: "",
        icon: "mdi mdi-shuffle-variant",
        visible: true,
        iconClick: (self: any) => {
          getDeviceName(windowInputs).then(({ data }) => {
            self.value = data.deviceName;
          });
        },
      },
      {
        type: "radio",
        label: "MAC地址",
        name: "macInfo",
        value: false,
        options: [
          { label: "真实", value: true },
          { label: "自定义", value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "macAddr", self.value === false);
        },
      },
      {
        type: "text",
        label: "#x 2",
        name: "macAddr",
        value: "",
        placeholder: "",
        icon: "mdi mdi-shuffle-variant",
        visible: true,
        iconClick: (self: any) => {
          // getMacAddr(windowInputs).then(({ data }) => {
          //   self.value = data.deviceName
          // })
        },
      },
      {
        type: "select",
        label: "硬件并发数",
        name: "hardwareConcurrent",
        placeholder: "请选择硬件并发数",
        value: "",
        options: $dict_map.hardwareConcurrent,
      },
      {
        type: "select",
        label: "设备内存",
        name: "deviceMemory",
        placeholder: "请选择设备内存",
        value: "",
        options: $dict_map.deviceMemory,
      },
      {
        type: "radio",
        label: "SSL指纹设置",
        name: "disableSsl",
        value: true,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "disableSslList", self.value === true);
        },
      },
      {
        type: "select",
        label: " ",
        name: "disableSslList",
        placeholder: "选择SSL指纹设置",
        value: $dict_map.disableSslList[0],
        options: $dict_map.disableSslList,
        visible: true,
        formatValue: (self: any) => {
          return [self.value];
        },
      },
      {
        type: "radio",
        label: "端口扫描保护",
        name: "portScanProtect",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
        change(_v: any, self: any, inputs: any) {
          setInputVisible(inputs, "portScanList", self.value === true);
        },
      },
      {
        type: "text",
        label: "扫描白名单",
        name: "portScanList",
        value: "",
        placeholder: "输入整数，多个用英文逗号隔开",
        visible: false,
      },
      {
        type: "radio",
        label: "硬件加速模式",
        name: "useGpu",
        value: true,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "禁用沙盒",
        name: "sandboxPermission",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "text",
        label: "启动参数",
        name: "startupParam",
        value: "",
        placeholder: "浏览器启动参数,如 --mute,多个参数以英文逗号分隔",
      },
    ],
    [
      {
        type: "radio",
        label: "窗口名称",
        name: "isDisplayName",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步书签",
        name: "syncBookmark",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步历史记录",
        name: "syncHistory",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步标签页",
        name: "syncTab",
        value: true,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步Cookie",
        name: "syncCookie",
        value: true,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步扩展应用程序",
        name: "syncExtensions",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步已保存的用户名密码",
        name: "syncPassword",
        value: true,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步IndexedDB",
        name: "syncIndexedDb",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "同步Local Storage",
        name: "syncLocalStorage",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "启动浏览器前删除缓存文件",
        name: "clearCacheFile",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "启动浏览器前删除Cookie",
        name: "clearCookie",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "启动浏览器时随机指纹",
        name: "randomFingerprint",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "弹出保存密码提示",
        name: "forbidSavePassword",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "网络不通停止打开",
        name: "stopOpenNet",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "IP发生变化停止打开",
        name: "stopOpenIP",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
      {
        type: "radio",
        label: "IP对应国家 / 地区发生改变停止打开",
        name: "stopOpenPosition",
        value: false,
        options: [
          { label: "开启", value: true },
          { label: "关闭", value: false },
        ],
      },
    ],
  ]);

  return windowInputs;
}
