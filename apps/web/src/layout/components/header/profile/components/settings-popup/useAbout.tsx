import type { ResourceUpdateMessage } from "@roxy/electron-preload";
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

export function useAbout() {
	getKernelList();

	function getAboutPanels(): SettingsModule {
		return {
			title: $t("关于"),
			description: $t("软件信息和更新。"),
			list: [
				{
					items: [
						{
							name: "about",
							text: () => {
								return <KernelUpdater coreList={coreList.value} />;
							},
						},
					],
				},
			],
		};
	}

	return {
		getAboutPanels,
	};
}
