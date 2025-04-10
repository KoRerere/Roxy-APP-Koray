import type { DynamicDialogInstance } from "primevue/dynamicdialogoptions";
import { API } from "/@/api";
import { useFormDialog } from "/@/hooks/useFormDialog";
import { useResponseToast } from "/@/hooks/useResponseToast";
import type {
	Items,
	SettingsModule,
} from "/@/layout/components/header/profile/type";
import { useUserStore } from "/@/stores/user";

export function useCommonUtil() {
	const [formDialog] = useFormDialog();
	const [showToast] = useResponseToast();
	const userStore = useUserStore();
	const { fetchUserInfo, updateUserConfig } = userStore;

	const dialogRef = inject<DynamicDialogInstance>("dialogRef");

	async function updateUserName(item: Items) {
		if (item.oldValue === item.value) return;

		const { code, msg } = await API.base.userChangeUsernameCreate({
			userName: item.value,
		});
		showToast(code, msg);
		if (code === 0) {
			fetchUserInfo();
			item.oldValue = item.value;
		}
	}

	async function saveUserConfig(
		item: Items,
		items: SettingsModule | null = null,
	) {
		if (!item.vaildator || item.vaildator(item)) {
			const value = item.formatValue?.(item) ?? item.value;
			const { code, msg } = await API.base.userSetUserConfigCreate({
				[item.name as any]: value,
			});
			showToast(code, msg);
			if (code === 0) {
				electronAPI.send("app:saveSoftConfig", { [item.name as any]: value });
				updateUserConfig();
			}

			if (items && item.name === "systemProxySwitch") {
				const v2 = items.list[0].items.find(
					(i: any) => i.name === "v2raySwitch",
				);

				if (v2) {
					v2.hide = !value;
				}
			}

			if (items && item.name === "simulation") {
				items.list[2].items.forEach((i: any) => {
					if (i.__type === "controlDisplay") {
						i.hide = !item.value;
					}
				})
			}
		}
	}

	async function detectLocalNetwork(item: Items) {
		try {
			item.value = await window.electronAPI.send(
				"proxy:detectNetwork",
				"local",
			);
		} catch (error) {
			item.value = null;
			showToast(-1, error);
		}
	}

	async function detectSystemNetwork(item: Items) {
		try {
			item.value = await window.electronAPI.send(
				"proxy:detectNetwork",
				"system",
			);
		} catch (error) {
			item.value = null;
			showToast(-1, error);
		}
	}

	return {
		dialogRef,
		formDialog,
		showToast,
		userStore,
		updateUserName,
		saveUserConfig,
		detectLocalNetwork,
		detectSystemNetwork,
	};
}
