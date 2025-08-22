import { format } from "date-fns";
import { API } from "/@/api";
import type { SettingsModule } from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import { isWindows } from "/@/utils";
import LoginDevices from "../login-devices.vue";
import type { UserGetLoginInfoListData } from "@roxy/backend-api";

const deviceInfo: Recordable = ref({});

requestIdleCallback(() => {
  electronAPI.send("util:getDeviceInfo").then(async (info) => {
    Object.assign(deviceInfo.value, info);
    console.debug("deviceInfo", deviceInfo.value);

    info.createTime = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    if (!info.address) {
      const result = await electronAPI.send("proxy:detectNetwork");
      deviceInfo.value.address = result.ip;
      deviceInfo.value.location = result.city;
      deviceInfo.value.platform = isWindows ? "win" : "mac";
      deviceInfo.value.createTime = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    }
  });
});

export function useLoginActive() {
  const currentDevice = ref<UserGetLoginInfoListData['data'][number]>();
  const historicalDevices = ref<UserGetLoginInfoListData['data']>([]);

  const getLoginActivityData = async () => {
    const { data: loginHistory } = await API.base.userGetLoginInfoList();
    const __currentDevice =
      loginHistory.find(
        (item) => item.deviceId === deviceInfo.value.deviceId,
      ) ||
      loginHistory.find(
        (item) =>
          decodeURIComponent(item.deviceName || "") ===
          decodeURIComponent(deviceInfo.value.deviceName),
      );

    historicalDevices.value = loginHistory.filter(
      (item) => item !== __currentDevice,
    );

    currentDevice.value = __currentDevice;
  }

  async function getLoginActivityPanels(): Promise<SettingsModule> {
    await getLoginActivityData();

    return {
      title: $t("登录历史"),
      description: $t("近 90 天内的登录记录"),
      list: [
        {
          subtitle: $t("当前设备"),
          items: [
            {
              name: "currentDevice",
              text: () => (
                <LoginDevices devices={reactive([currentDevice.value || deviceInfo.value])} isEdit={true} onChange={getLoginActivityData} />
              ),
            },
          ],
        },
        ...(historicalDevices.value.length
          ? [
            {
              subtitle: $t("历史设备"),
              items: [
                {
                  name: "historicalDevices",
                  text: () => <LoginDevices devices={historicalDevices.value} />,
                },
              ],
            },
          ]
          : []),
      ],
    };
  }

  return {
    getLoginActivityPanels,
  };
}
