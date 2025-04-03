import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputNumber from "primevue/inputnumber";
import RxButton from "/@/components/rx-button";
import RxToggleSwitch from "/@/components/rx-toggle-switch";
import RxInputSelect from "/@/components/ry-form/rx-input-select.vue";
import { UaStrictMode } from "/@/enums";
import { useCommonUtil } from "/@/layout/components/header/profile/components/settings-popup/useCommonUtil";
import type {
	Items,
	SettingsModule,
} from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import FolderDirectory from "../folder-directory.vue";

export function usePreferencesPanel() {
	const { saveUserConfig } = useCommonUtil();

	const getPreferencesPanels = async (data?: any): Promise<SettingsModule> => {
		const softConfig = await electronAPI.send("app:getSoftConfig");

		return {
			title: $t("软件设置"),
			description: $t("设置您的客户端使用偏好"),
			list: [
				// !todo: 后台暂时没做，一期暂时隐藏
				// {
				//   subtitle: $t('界面'),
				//   items: [
				//     {
				//       label: $t('语言'),
				//       text: $t('没有您需要的语言? <span class="text-blue">联系我们</span>'),
				//       name: 'language',
				//       value: $dict_map.language?.find((item: any) => item.value === data.language) ?? $dict_map.language[0],
				//       props: {
				//         filter: false,
				//         optionValue: 'value',
				//         options: $dict_map.language,
				//         virtualScrollerOptions: { itemSize: 38 },
				//       },
				//       formatValue: (item: Items) => item.value.value,
				//       component: ({ item, ...props }: { item: Items, props: any }) => {
				//         return (
				//           <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
				//         )
				//       },
				//     },
				//     {
				//       label: $t('时区'),
				//       text: $t('#Some hints for you'),
				//       name: 'timeZone',
				//       value: data?.timeZone ?? '',
				//       props: {
				//         filter: false,
				//         optionValue: 'value',
				//         options: $dict_map.timeZone,
				//       },
				//       component: ({ item, ...props }: { item: Items, props: any }) => {
				//         return (
				//           <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
				//         )
				//       },
				//     },
				//     {
				//       label: $t('#Appearance'),
				//       text: $t('#Themes for different mode'),
				//       name: 'appearance',
				//       value: data?.appearance?.toString() ?? '',
				//       props: {
				//         filter: false,
				//         optionValue: 'value',
				//         options: [
				//           { label: $t('系统'), value: `${SettingAppearance.system}` },
				//           { label: $t('#Light'), value: `${SettingAppearance.light}` },
				//           { label: $t('#Dark'), value: `${SettingAppearance.dark}` },
				//         ],
				//       },
				//       formatValue: (item: Items) => Number(item.value),
				//       component: ({ item, ...props }: { item: Items, props: any }) => {
				//         return (
				//           <RxInputSelect {...item.props} {...props} name={item.name} onChange={() => saveUserConfig(item)} />
				//         )
				//       },
				//     },
				//   ],
				// },
				{
					subtitle: $t("窗口"),
					items: [
						{
							label: $t("UA 严格模式"),
							text: () => (
								<div class="w-[370px]">
									{$t(
										"关闭此选项后，可以自定义浏览器的版本。一般情况下我们推荐保持该选项开启。",
									)}
								</div>
							),
							name: "uaModeSwitch",
							value: data?.uaModeSwitch ?? UaStrictMode.open,
							props: {
								trueValue: UaStrictMode.open,
								falseValue: UaStrictMode.close,
							},
							component: ({ item, ...props }: { item: Items; props: any }) => {
								return (
									<RxToggleSwitch
										{...item.props}
										{...props}
										onChange={() => saveUserConfig(item)}
									/>
								);
							},
						},
					],
				},
				{
					subtitle: $t("本地设置"),
					items: [
						{
							label: $t("缓存目录"),
							text: $t("设置 RoxyBrowser 缓存路径"),
							name: "browserCacheRootDir",
							value: softConfig.browserCacheRootDir ?? "",
							props: {
								disabled: true,
							},
							component: ({ item, ...props }: { item: Items; props: any }) => {
								return (
									<FolderDirectory
										item={item}
										{...item.props}
										{...props}
										onChange={() => saveUserConfig(item)}
									/>
								);
							},
						},
						{
							label: $t("系统日志"),
							name: "systemLogDir",
							value: "",
							component: () => {
								return (
									<RxButton
										severity="secondary"
										outlined
										onClick={() => electronAPI.send("app:showLogDir")}
									>
										{$t("查看详情")}
									</RxButton>
								);
							},
						},
						{
							label: $t("内存限制"),
							name: "memoryLimit",
							value: data?.memoryLimit ?? "",
							text: () => (
								<div class="w-[370px]">
									{$t("内存使用达到设置的阈值时，将停止打开浏览器窗口")}
								</div>
							),
							component: ({ item, ...props }: { item: Items; props: any }) => {
								return (
									<div class="flex">
										<IconField class="w-[60px]">
											<InputNumber
												{...item.props}
												{...props}
												name={item.name}
												useGrouping={false}
												fluid
												min={0}
												max={100}
												onValueChange={() => saveUserConfig(item)}
											/>
											<InputIcon>%</InputIcon>
										</IconField>
									</div>
								);
							},
						},
						{
							label: $t("关闭客户端"),
							text: $t("当点击关闭客户端时"),
							name: "closeSoft",
							value: data?.closeSoft ?? "",
							props: {
								filter: false,
								optionValue: "value",
								options: [
									{ label: $t("弹出提示"), value: "pop" },
									{ label: $t("最小化到托盘"), value: "min" },
									{ label: $t("退出程序"), value: "exit" },
								],
							},
							component: ({ item, ...props }: { item: Items; props: any }) => {
								return (
									<RxInputSelect
										{...item.props}
										{...props}
										name={item.name}
										onChange={() => saveUserConfig(item)}
									/>
								);
							},
						},

						// TODO: 这里需要添加应用上锁相关的设
						// 1. 设置解锁密码
						// 2. 设置快捷键
					],
				},
			],
		};
	};

	return {
		getPreferencesPanels,
	};
}
