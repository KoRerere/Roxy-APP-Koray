import type { UserGetUserConfigListData, UserGetUserInfoListData, UserGetUserPayInfoListData } from "@roxy/backend-api";
import mixpanel from "mixpanel-browser";
import { defineStore } from "pinia";
import { ref } from "vue";
import { API } from "/@/api";
import { $t } from "/@/locales";
import { useSimpleLocale } from "/@/stores/locale";
import { useWorkspaceStore } from "/@/stores/workspace";
import { emitter } from "/@/utils/eventBus";
import { useRoleStore } from "/@/stores/role";
import router from "/@/router";
import { useToast } from "primevue/usetoast";
import { SubLevelEnum } from "/@/enums/pay";

type UserInfo = Partial<UserGetUserInfoListData["data"]>;
type UserConfig = Partial<UserGetUserConfigListData["data"]>;

export const useUserStore = defineStore(
  "user",
  () => {
    const toast = useToast()
    const locale = useSimpleLocale();
    const workspaceStore = useWorkspaceStore();
    const roleStore = useRoleStore();

    /** 用户信息 */
    const userInfo = ref<UserInfo>({});
    /** 用户付费详情 */
    const userPayInfo = ref<UserGetUserPayInfoListData["data"]>({} as UserGetUserPayInfoListData["data"]);
    const userConfig = ref<UserConfig>();
    const token = ref('');
    const appVersion = ref("");
    const rememberMe = ref(false);
    /** rememberMe 为 true 的时候有值 */
    const password = ref("");

    /** 是否为过期用户 */
    const isExpiredUser = computed(() => {
      return userPayInfo.value.subEndDate && Date.now() > userPayInfo.value.subEndDate
    })

    /** 用户身份 */
    const identityInfo = computed(() => {
      const { identity } = userInfo.value;
      if (identity === "old") {
        return {
          text: $t("创始用户"),
          icon: "referral-program/golden",
          iconSmall: "referral-program/golden-small",
          color: "#DFAB65",
        };
      } else if (identity === "invited") {
        return {
          text: $t("特邀用户"),
          icon: "referral-program/diamond",
          iconSmall: "referral-program/diamond-small",
          color: "#7B88C2",
        };
      } else if (identity === "agent") {
        return {
          text: $t("合作用户"),
          icon: "referral-program/agent",
          iconSmall: "referral-program/agent-small",
          color: "#12A3FC",
        };
      }
      return {
        text: $t("普通用户"),
        color: "#171C1F",
      };
    });

    async function getUserInfo() {
      const { code, data } = await fetchUserInfo();

      if (code === 0) {
        setUserInfo(data);
        workspaceStore.setCurrentWorkspace(data.workspaceId);
      } else {
        // 如果获取用户信息失败，则清除用户信息
        clearUserInfo();
        router.push({ name: "login" });
        toast.add({
          severity: 'error',
          summary: $t('提示'),
          detail: $t('获取用户信息失败，请重新登录'),
          life: 5000,
        })
      }
    }

    async function fetchUserInfo() {
      const result = await API.base.userGetUserInfoList();
      if (result.code === 0) {
        userInfo.value = result.data;
      }
      return result;
    }

    function setUserInfo(info: UserInfo) {
      userInfo.value = info;
      // 这里是为了避免频繁切换语言的时候，频繁的进程通信导致页面卡顿
      setTimeout(() => {
        window.electronAPI.send("user:setUserInfo", {
          token: token.value,
          userId: userInfo.value.id!,
        });
      });

      requestIdleCallback(async () => {
        mixpanel.identify(String(userInfo.value.id));

        const localNetwork = await window.electronAPI.send("proxy:detectNetwork", "local");

        mixpanel.people.set({
          $name: userInfo.value.userName,
          $email: userInfo.value.email,
          $language: locale.currentLocale,
          $region: localNetwork.region,
          $city: localNetwork.city,
          $localNetwork: localNetwork,
          $appVersion: appVersion.value,
        });
      });
    }

    function clearUserInfo() {
      userInfo.value = {
        email: userInfo.value.email,
      }
      // password.value = ''
      token.value = ''
      electronAPI.send('user:logout')
      mixpanel.reset()
      workspaceStore.resetWorkspace()
    }

    async function getUserConfig(force = false) {
      if (!force && userConfig.value) {
        return userConfig.value;
      }
      return updateUserConfig();
    }

    async function updateUserConfig() {
      const { code, data } = await API.base.userGetUserConfigList();
      if (code === 0) {
        userConfig.value = data;
      }
      return userConfig.value;
    }

    /** 获取用户付费详情 */
    async function getUserPayInfo() {
      const { code, data } = await API.pay.userGetUserPayInfoList();

      if (code === 0) {
        userPayInfo.value = data;
        if (roleStore.isOwner) {
          // 如果用户付费信息过期，则显示弹窗
          if (data.showSubExpiredDlg) {
            emitter.emit('showSubscriptionExpiredDialog')
          }
          // 旧用户首次登录，显示升级套餐弹窗
          if (data.showPayWallDlg) {
            emitter.emit('showUpgradePlanDialog')
          }
          // 旧用户首次登录，显示礼包弹窗
          if (data.showGiftDlg) {
            emitter.emit('showOldUserGiftDialog')
          }
        }

        electronAPI.send('app:saveSoftConfig', { subLevel: data.subLevel })

        // 免费用户或者过期用户，关闭窗口同步器
        console.log('can use syncControl:', [SubLevelEnum.Free, SubLevelEnum.Expired].includes(data.subLevel as SubLevelEnum), data.subLevel)
        if ([SubLevelEnum.Free, SubLevelEnum.Expired].includes(data.subLevel as SubLevelEnum)) {
          console.log('免费用户或者过期用户，关闭所有同步相关的弹窗')
          electronAPI.send('syncControl:close');
          setTimeout(() => {
            electronAPI.send('syncControl:stop', false);
          }, 500)
        }
      }
    }

    function setToken(_token: string) {
      token.value = _token;
    }

    /** 记住我的时候需要保存密码 */
    function setPassword(pwd: string) {
      password.value = btoa(pwd);
    }

    const initUserInfo = async () => {
      if (token.value) {
        getUserInfo();
      }
    };

    scheduler.postTask(initUserInfo, { priority: "background" });

    requestIdleCallback(async () => {
      const version = await electronAPI.send("app:getAppVersion");
      appVersion.value = version;
    });

    return {
      token,
      rememberMe,
      userInfo,
      userPayInfo,
      password,
      appVersion,
      identityInfo,
      isExpiredUser,
      setPassword,
      clearUserInfo,
      setToken,
      getUserInfo,
      getUserConfig,
      updateUserConfig,
      fetchUserInfo,
      getUserPayInfo,
      initUserInfo,
    };
  },
  {
    persist: true,
  },
);
