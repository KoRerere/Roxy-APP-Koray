import InputText from "primevue/inputtext";
import { API } from "/@/api";
import { RxAlert } from "/@/components/rx-alert";
import RxButton from "/@/components/rx-button";
import { RxSvgIcon } from "/@/components/rx-icon/";
import {
  getResetPasswordFormSchemas,
  getSettingPasswordFormSchemas,
} from "/@/layout/components/header/profile/components/schemas";
import { useCommonUtil } from "/@/layout/components/header/profile/components/settings-popup/useCommonUtil";
import type { Items, SettingsModule } from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import UploadAvatar from "../upload-avatar.vue";
import { useDialog } from "/@/hooks/useDialog";
import Tooltip from 'primevue/tooltip';
import { h, withDirectives, type ObjectDirective } from 'vue'
import ThirdAccount from "./components/third-account.vue";
import { oauth2LoginMap, useOauth2Callback } from "/@/utils";
import { useToast } from "primevue/usetoast";

// TODO 解决 options.instance 为 null 的问题，为 null 会报错
const MyTooltip: ObjectDirective = {
  ...Tooltip,
  beforeMount(el, options) {
    // console.log("beforeMount", el, options);
    options.instance ||= {}
    Tooltip.beforeMount(el, options);
  },
}

const EmailChangeDialog = defineAsyncComponent(() => import("./components/email-change-dialog.vue"));

export function useUserProfilePanel() {
  const toast = useToast()
  const { userStore, updateUserName, dialogRef, showToast, showFormDialog } = useCommonUtil();
  const router = useRouter();
  const [showModal] = useDialog()
  const { fetchUserInfo } = userStore;
  const currentData = ref({} as Recordable<any>)

  // 处理第三方账号登录
  useOauth2Callback(async (params) => {
    const { source, api } = params
    const { code, msg } = await api()

    if (code === 0) {
      updateUserBindEmailList()
      toast.add({
        severity: 'success',
        summary: $t('成功'),
        detail: $t('第三方账号绑定成功'),
        life: 3000,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: $t('失败'),
        detail: msg,
        life: 3000,
      })
    }
  })

  /** 显示设置密码弹窗 */
  async function showSettingPasswordDialog() {
    console.log("showSettingPasswordDialog");

    await showFormDialog({
      header: $t("设置密码"),
      class: "w-[400px]",
      schemas: getSettingPasswordFormSchemas(),
      formProps: {
        layout: "vertical",
        initialValues: {
          email: userStore.userInfo?.email,
        },
      },
      dialogSlots: {
        beforeForm: () => (
          <RxAlert
            visible={true}
            type="info"
            title={$t("使用邮箱和密码登录您的账号")}
            closable={false}
            class="w-full"
          />
        ),
      },
      handleOk: async (params: any) => {
        const res = await API.base.userSettingPasswordCreate({ ...params });
        showToast(res.code, res.msg);
        if (res.code === 0 && params.password) {
          userStore.setPassword(params.password);
          showToast(0, $t("密码设置成功"));
          userStore.fetchUserInfo();
        } else {
          return Promise.reject(res.msg);
        }
      },
    });
  }

  /** 显示重置密码弹窗 */
  async function showResetPasswordDialog() {
    console.log("showResetPasswordDialog");

    await showFormDialog({
      header: $t("重置密码"),
      class: "w-[400px]",
      schemas: getResetPasswordFormSchemas(),
      formProps: {
        layout: "vertical",
      },
      handleOk: async (params: any) => {
        const res = await API.base.userChangePwdCreate({
          old_pwd: params.oldPassword,
          new_pwd: params.newPassword,
        });
        if (res.code === 0) {
          userStore.setPassword("");
          userStore.clearUserInfo();
          showToast(0, $t("密码重置成功"));
          dialogRef?.value?.close?.();
          setTimeout(() => {
            router.push({ name: "login" });
          });
        } else {
          showToast(res.code, res.msg);
          return Promise.reject(res.msg);
        }
      },
    });
  }

  async function updateAvatar(item: Items) {
    const { code, msg } = await API.base.userUploadAvatarCreate({
      avatar: item.value,
    });
    showToast(code, msg);
    if (code === 0) {
      fetchUserInfo();
    }
  }

  function showEmailChangeDialog() {
    showModal({
      header: $t("修改邮箱"),
      class: "!w-[384px]",
      slots: {
        default: ({ hideModal }) => {
          const onSuccess = async () => {
            hideModal()
            const { code, data } = await fetchUserInfo()
            if (code === 0) {
              Object.assign(currentData.value, data)
            }
          }
          return <EmailChangeDialog onSuccess={onSuccess} />
        },
        footer: undefined
      },
    });
  }

  async function updateUserBindEmailList() {
    const { code, data } = await API.base.userBindEmailListList()

    if (code === 0) {
      Object.assign(currentData.value, Object.fromEntries(data.map(item => [
        `tp_${item.bindType.toLowerCase()}`,
        item.bindType.toLowerCase() === 'google' ? item.thirdEmail : item.thirdUserName,
      ])))
    }
  }

  async function getUserProfilePanels(data?: any): Promise<SettingsModule> {

    Object.assign(currentData.value, data)

    await updateUserBindEmailList()

    return {
      title: $t("个人信息"),
      description: $t("设置您的账号信息和邮箱"),
      list: [
        {
          subtitle: $t("基础信息"),
          items: [
            {
              label: $t("个人头像"),
              text: $t("推荐尺寸为 64*64，最大不超过 2MB"),
              name: "avatar",
              classes: "flex-col !items-start gap-4",
              value: currentData.value?.avatar ?? "",
              props: {
                class: "resize-none w-full",
                userName: currentData.value.userName,
                avatarColor: currentData.value.avatarColor,
              },
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return (
                  <UploadAvatar
                    {...item.props}
                    {...props}
                    onChange={() => updateAvatar(item)}
                  />
                );
              },
            },
            {
              label: $t("用户名"),
              name: "userName",
              value: currentData.value?.userName ?? "",
              oldValue: currentData.value?.userName,
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return (
                  <InputText
                    {...item.props}
                    {...props}
                    class="!w-0 flex-1"
                    type="text"
                    onBlur={() => updateUserName(item)}
                  />
                );
              },
            },
            {
              label: $t("邮箱地址"),
              name: "email",
              value: currentData.value?.email ?? "",
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return <div class="w-full flex gap-2 items-center justify-between">
                  {withDirectives(h("div", { class: "truncate w-[152px]" }, currentData.value?.email), [
                    [MyTooltip, { value: currentData.value?.email }, '', { top: true }]
                  ])}
                  <RxButton
                    severity="secondary"
                    size="sm"
                    outlined
                    onClick={showEmailChangeDialog}
                  >
                    {$t("修改邮箱")}
                  </RxButton>
                </div>;
              },
            },
            {
              label: $t("密码"),
              name: "password",
              component: ({ item, ...props }: { item: Items; props: any }) => {
                const hasPassword = userStore.userInfo?.setPasswordStatus;
                return (
                  <div class="w-full flex items-center justify-between">
                    <div>{hasPassword ? "********" : $t("当前未设置密码")}</div>
                    <RxButton
                      severity="secondary"
                      size="sm"
                      outlined
                      onClick={
                        hasPassword
                          ? showResetPasswordDialog
                          : showSettingPasswordDialog
                      }
                    >
                      {hasPassword ? $t("重置密码") : $t("设置密码")}
                    </RxButton>
                  </div>
                );
              },
            },
          ],
        },
        {
          subtitle: $t("第三方账号"),
          items: [
            {
              name: 'Google',
              value: currentData.value?.tp_google ?? "",
              label: () => {
                return <div class="flex items-center gap-2">
                  <RxSvgIcon name="websites/rx_site_google" />
                  <span>Google</span>
                </div>
              },
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return <ThirdAccount value={currentData.value?.tp_google} bindType="Google" onBind={oauth2LoginMap.google} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'Github',
              value: currentData.value?.tp_github ?? "",
              label: () => {
                return <div class="flex items-center gap-2">
                  <RxSvgIcon name="websites/rx_site_github" />
                  <span>Github</span>
                </div>
              },
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return <ThirdAccount value={currentData.value?.tp_github} bindType="Github" onBind={oauth2LoginMap.github} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'Facebook',
              value: currentData.value?.tp_facebook ?? "",
              label: () => {
                return <div class="flex items-center gap-2">
                  <RxSvgIcon name="websites/rx_site_facebook" />
                  <span>Facebook</span>
                </div>
              },
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return <ThirdAccount value={currentData.value?.tp_facebook} bindType="Facebook" onBind={oauth2LoginMap.facebook} onUnbind={updateUserBindEmailList} />
              },
            },
            {
              name: 'VK',
              value: currentData.value?.tp_vk ?? "",
              label: () => {
                return <div class="flex items-center gap-2">
                  <RxSvgIcon name="websites/rx_site_vk" />
                  <span>VK (ВКонтакте)</span>
                </div>
              },
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return <ThirdAccount value={currentData.value?.tp_vk} bindType="VK" onBind={oauth2LoginMap.vk} onUnbind={updateUserBindEmailList} />
              },
            }
          ]
        },
      ],
    };
  }

  return {
    getUserProfilePanels,
  };
}
