import type { ResourceUpdateMessage } from "@roxy/electron-preload";
import type {
  Items,
  SettingsModule,
} from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import About from "./components/about.vue";

const clientUpdates = ref<ResourceUpdateMessage[]>([])

async function checkForUpdates() {
  const result = await globalThis.electronAPI.send('app:checkForUpdates')
  if (result && !clientUpdates.value.some(item => item.type === 'app')) {
    clientUpdates.value.push(result)
  }
}

async function checkWebForUpdates() {
  globalThis.electronAPI.send('app:checkWebForUpdates')
}

globalThis.electronAPI.on("app:resource-update", (data) => {
  // 内核升级
  if (data.type !== "kernel") {
    const index = clientUpdates.value.findIndex(item => data.type === item.type)
    if (index === -1) {
      clientUpdates.value.push(data)
    }
    else {
      clientUpdates.value[index] = data
    }
  }
});

requestIdleCallback(checkForUpdates)

export function useAbout() {
  checkWebForUpdates()

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
                return <About upgradeList={clientUpdates.value} />;
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
