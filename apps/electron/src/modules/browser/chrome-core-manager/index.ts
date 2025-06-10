import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type {
  UnwrapRowsType,
  UserGetCoreUpgradeCreateData,
} from "@roxy/backend-api";
import type { ResourceUpdateMessage } from "@roxy/electron-preload";
import { compare } from "compare-versions";
import { API } from "/@/api";
import { osConfig } from "/@/constants";
import { appConfig } from "/@/constants/appConfig";
import { browserManager } from "/@/modules/browser/browser-manager";
import { ipcMain } from "/@/modules/ipc";
import { downloadZipFile, fileExists, findProcessByHandle, getProcessIdsByExePath, isMac, unzipFile } from "/@/utils";
import { setTimeout } from "node:timers/promises";

export const chromeCoreManager = new (class ChromeCoreManager {
  /** 拉取内核 promise */
  private fetchAvailableCoreListPromise: Promise<UserGetCoreUpgradeCreateData> | null =
    null;
  /** 内核执行程序文件名称 */
  private chromeBinName = isMac
    ? "RoxyChrome.app/Contents/MacOS/RoxyChrome"
    : "RoxyChrome.exe";

  /** 正在下载中的内核 */
  private downloadingMap = new Map<string, Promise<any>>();
  /** msgCallback task map */
  private msgCallbackTaskMap = new Map<string, ((payload: Partial<ResourceUpdateMessage>) => void)[]>();
  /** 正在使用中的内核 */
  get usingCores() {
    const cores = [...browserManager.openedBrowserMap.values()].map(
      (browserItem) => browserItem.winInfo.coreVersion,
    );
    return new Set(cores);
  }

  /** 能够被当前系统使用的内核列表 */
  private availableCoreList: UnwrapRowsType<UserGetCoreUpgradeCreateData> = [];

  constructor() {
    queueMicrotask(() => {
      this.fetchAvailableCoreList().then(async () => {
        // 本地是否存在内核，不存在时静默下载最新内核
        const exeExistsList = await Promise.all(this.availableCoreList.map(async (core) => {
          return fileExists(this.genCoreExePath(core.coreVersion!))
        }))
        const isNotExistsCore = exeExistsList.every((exists) => !exists)
        console.log("isNotExistsCore", isNotExistsCore)
        // 如果本地不存在内核，则下载最新内核
        if (isNotExistsCore) {
          const [latestCore] = this.availableCoreList.toSorted((a, b) => b.coreVersion - a.coreVersion)
          if (latestCore?.coreVersion) {
            this.downloadCore(latestCore.coreVersion, undefined, true)
          }
        }
      })
    })
  }

  /** 获取内核列表（供前端展示用） */
  async getCoreList(): Promise<ResourceUpdateMessage[]> {
    if (!this.availableCoreList.length) {
      await this.fetchAvailableCoreList();
    }
    const arr = this.availableCoreList.map(
      async (core): Promise<ResourceUpdateMessage> => {
        return {
          ...core,
          type: "kernel",
          version: core.version,
          coreVersion: core.coreVersion,
          status: (await fileExists(this.genCoreDir(core.coreVersion)))
            ? "downloaded"
            : "uninstalled",
        };
      },
    );
    return Promise.all(arr);
  }

  /** 根据内核版本获取内核所在目录 */
  private genCoreDir(coreVersion: string) {
    const { chromeBinDir } = appConfig;
    return join(chromeBinDir, coreVersion);
  }

  /** 根据内核版本组成内核执行文件路径 */
  private genCoreExePath(coreVersion: string) {
    return join(this.genCoreDir(coreVersion), this.chromeBinName);
  }

  /** 根据内核版本获取内核驱动文件路径 */
  genCoreDriverPath(coreVersion: string) {
    return join(
      this.genCoreDir(coreVersion),
      isMac ? "chromedriver" : "chromedriver.exe",
    );
  }

  /** 获取指定的可用内核 */
  getAvailableCore(coreVersion: string) {
    return this.availableCoreList.find(
      (core) => core.coreVersion === coreVersion,
    );
  }

  /** 拉取当前系统可用的内核列表 */
  async fetchAvailableCoreList() {
    console.log("fetchAvailableCoreList", osConfig);
    this.fetchAvailableCoreListPromise ||= API.base.getCoreUpgradeCreate({
      ...osConfig,
    });
    const result = await this.fetchAvailableCoreListPromise
      .catch((err) => {
        console.error("fetchAvailableCoreList error", err);
        return Promise.reject(err);
      })
      .finally(() => {
        this.fetchAvailableCoreListPromise = null;
      });
    console.debug("user_get_core_upgrade", result);
    this.availableCoreList = result.data?.rows || [];

    if (this.availableCoreList.length) {
      ipcMain.send("app:core-list-update", await this.getCoreList());
    }

    return result;
  }

  /** 根据内核版本获取对应的内核执行文件 */
  async getCoreExePath(
    coreVersion: string,
    msgCallback?: (payload: Partial<ResourceUpdateMessage>) => void,
    silent = false
  ) {
    if (!this.availableCoreList.length) {
      await this.fetchAvailableCoreList().catch((error) => {
        msgCallback?.({ description: $t("获取内核列表失败") });
        return Promise.reject(error);
      });
    }

    const availableCore = this.getAvailableCore(coreVersion);

    if (!availableCore) {
      throw new Error($t("当前系统不支持使用{version}内核", { version: coreVersion }));
    }

    const exePath = this.genCoreExePath(coreVersion);

    // 如果该内核已经在使用中，则直接返回
    if (this.usingCores.has(coreVersion)) {
      return exePath;
    }

    const coreDir = this.genCoreDir(coreVersion);
    const isExeExists = await fileExists(exePath);
    const isVersionFileExists = await fileExists(join(coreDir, "version"));

    // 如果本地不存在该内核或版本文件不存在，则下载
    if (!isExeExists || !isVersionFileExists) {
      // 等待下载完成
      await this.downloadCore(coreVersion, msgCallback, silent);
    }

    try {
      // 本地内核版本
      const localCoreVersion = await readFile(
        join(coreDir, "version"),
        "utf-8",
      );
      // 如果本地内核版本小于远程内核版本
      if (compare(localCoreVersion.trim(), availableCore.version, "<")) {
        // 重新下载
        await this.downloadCore(coreVersion, msgCallback);
      }
    } catch (error) {
      console.error("getCoreExePath error", error);
      return Promise.reject(error);
    }

    console.log("getCoreExePath", exePath);

    return exePath;
  }

  /** 下载内核 */
  async downloadCore(coreVersion: string, msgCallback?: (payload: Partial<ResourceUpdateMessage>) => void, silent = false) {
    if (this.downloadingMap.has(coreVersion)) {
      if (msgCallback) {
        if (this.msgCallbackTaskMap.has(coreVersion)) {
          this.msgCallbackTaskMap.get(coreVersion)?.push(msgCallback);
        } else {
          this.msgCallbackTaskMap.set(coreVersion, [msgCallback]);
        }
      }
      const promise = this.downloadingMap.get(coreVersion)
      promise && Reflect.set(promise, 'silent', silent)
      return promise
    }

    const availableCore = this.getAvailableCore(coreVersion);

    if (!availableCore) {
      throw new Error($t("当前系统不支持使用{version}内核", { version: coreVersion }));
    }

    const outputZipPath = join(appConfig.chromeBinDir, `${coreVersion}.zip`);
    const that = this
    const payload: ResourceUpdateMessage = {
      type: "kernel",
      status: "downloading",
      percent: 0,
      description: $t("正在下载 {coreVersion} 内核", { coreVersion }),
      version: availableCore.version,
      coreVersion,
      get silent() {
        return Reflect.get(that.downloadingMap.get(coreVersion) || {}, 'silent') ?? silent
      },
    };

    const doMsgCallbacks = () => {
      ipcMain.send("app:resource-update", payload);
      msgCallback?.(payload)
      if (this.msgCallbackTaskMap.has(coreVersion)) {
        this.msgCallbackTaskMap.get(coreVersion)?.forEach((callback) => {
          callback(payload);
        });
      }
    }

    const unzipTask = async () => {
      // 删除本地内核
      await rm(this.genCoreDir(coreVersion), {
        recursive: true,
        force: true,
      });
      payload.description = $t("正在解压内核");
      doMsgCallbacks()
      // 解压缩内核
      await unzipFile(outputZipPath, appConfig.chromeBinDir);
      payload.description = $t("内核解压完成");
      payload.percent = 100;
      doMsgCallbacks()
      // 异步删除下载的 zip 文件，不需要等待
      rm(outputZipPath);
    }

    const downloadTask = async () => {
      try {
        console.log("downloadCore start", coreVersion);
        // 下载内核
        await downloadZipFile(
          availableCore.downloadUrl!,
          outputZipPath,
          (progress) => {
            // console.log(`Download progress: ${progress}%`)
            payload.percent = Math.min(progress, 99);
            payload.status = "downloading";
            payload.description = $t("正在下载内核");
            doMsgCallbacks()
          },
        ).catch((error) => {
          console.error("downloadCore downloadZipFile error", error);
          payload.status = "failed";
          payload.description = $t("下载内核失败");
          doMsgCallbacks()
          return Promise.reject(new Error(payload.description));
        });
        await unzipTask();
        payload.status = "downloaded";
        payload.description = $t("内核下载完成");
        doMsgCallbacks()
      } catch (error: any) {
        console.dir(error, { depth: null });
        console.error("downloadCore error", error);
        if (error?.code === 'EBUSY') {
          // const processIds = await getProcessIdsByExePath(this.genCoreDir(coreVersion));
          const processIds = await findProcessByHandle(this.genCoreDir(coreVersion));
          console.log("findProcessByHandle", processIds);
          if (processIds) {
            try {
              processIds.forEach(({ pid }) => {
                process.kill(pid);
              });
            } catch (error) {
              console.error("killProcess error", error);
            }

            if (payload.status === "downloaded" && await fileExists(outputZipPath)) {
              await setTimeout(3000)
              try {
                console.log("unzipTask start");
                await unzipTask();
                console.log("unzipTask end");
                return
              } catch (error) {
                console.error("unzipTask error", error);
                return Promise.reject(error);
              }
            }
          }
        } else if (error?.code === 'ENOENT' || error?.message?.includes('no such file or directory')) {
          payload.status = "failed";
          payload.description = $t("内核解压失败，请检查是否被杀毒软件拦截");
          doMsgCallbacks()
          error.message = $t("内核解压失败，请检查是否被杀毒软件拦截")
          rm(this.genCoreDir(coreVersion), {
            recursive: true,
            force: true,
          });
        } else {
          payload.status = "failed";
          payload.description = $t("下载内核失败");
          doMsgCallbacks()
        }
        return Promise.reject(error);
      } finally {
        // 无论成功与否，记得将其从下载队列中移除
        this.downloadingMap.delete(coreVersion);
        this.msgCallbackTaskMap.delete(coreVersion);
      }
    };

    this.downloadingMap.set(coreVersion, downloadTask());
    return this.downloadingMap.get(coreVersion);
  }

  /** 删除指定内核 */
  async deleteCore(coreVersion: string) {
    if (this.usingCores.has(coreVersion)) {
      return Promise.reject($t("当前内核正在使用中，无法删除"));
    }
    await rm(this.genCoreDir(coreVersion), { recursive: true, force: true });
  }
})();
