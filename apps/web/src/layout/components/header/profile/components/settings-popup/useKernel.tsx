import type { ResourceUpdateMessage } from "@roxy/electron-preload";
import { I18nT } from "vue-i18n";
import type {
	Items,
	SettingsModule,
} from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import KernelUpdater from "./components/kernel-updater.vue";

const coreList = ref<ResourceUpdateMessage[]>([]);

async function getKernelList() {
	const list = await window.electronAPI.send("app:getCoreList");
	console.log("getKernelList", list);
	coreList.value = list.sort((a, b) => b.coreVersion - a.coreVersion);
}

window.electronAPI.on("app:resource-update", (data) => {
	// 内核升级
	if (data.type === "kernel") {
		const index = coreList.value.findIndex(
			(item) => item.coreVersion === data.coreVersion,
		);
		if (index === -1) {
			coreList.value.push(data);
		} else {
			coreList.value[index] = data;
		}
		coreList.value.sort((a, b) => b.coreVersion - a.coreVersion);
	}
});

getKernelList();

export function useKernel() {
	getKernelList();

	function getKernelPanels(): SettingsModule {
		return {
			title: $t("内核管理"),
			description: $t("Chrome 内核变更日志和更新。"),
			list: [
				{
					items: [
						{
							label: $t("Chromium"),
							classes: "flex-col !items-start gap-4",
							text: () => (
								<I18nT
									keypath={$t("访问 {link} 获取详细信息和更新信息。", {
										link: "{link}",
									})}
								>
									{{
										link: () => (
											<a
												href="https://roxybrowser.com"
												target="_blank"
												rel="noreferrer"
											>
												roxybrowser.com
											</a>
										),
									}}
								</I18nT>
							),
							name: "kernel",
							component: ({ item, ...props }: { item: Items; props: any }) => {
								return (
									<KernelUpdater
										{...item.props}
										{...props}
										coreList={coreList.value}
									/>
								);
							},
						},
					],
				},
			],
		};
	}

	return {
		getKernelPanels,
	};
}
