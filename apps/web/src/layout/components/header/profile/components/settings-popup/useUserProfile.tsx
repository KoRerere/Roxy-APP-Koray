import InputText from "primevue/inputtext";
import { API } from "/@/api";
import { RxAlert } from "/@/components/rx-alert";
import RxButton from "/@/components/rx-button";
import {
  getResetPasswordFormSchemas,
  getSettingPasswordFormSchemas,
} from "/@/layout/components/header/profile/components/schemas";
import { useCommonUtil } from "/@/layout/components/header/profile/components/settings-popup/useCommonUtil";
import type {
  Items,
  SettingsModule,
} from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import UploadAvatar from "../upload-avatar.vue";
import { useDialog } from "/@/hooks/useDialog";
import Tooltip from 'primevue/tooltip';
import { h, withDirectives } from 'vue'

// TODO 解决 options.instance 为 null 的问题，为 null 会报错
const MyTooltip = {
  ...Tooltip,
  beforeMount(el, options) {
    console.log("beforeMount", el, options);
    options.instance ||= {}
    Tooltip.beforeMount(el, options);
  },
}

const EmailChangeDialog = defineAsyncComponent(() => import("./components/email-change-dialog.vue"));

export function useUserProfilePanel() {
  const { userStore, updateUserName, dialogRef, showToast, formDialog } = useCommonUtil();
  const router = useRouter();
  const [dialogInstance] = useDialog()
  const { fetchUserInfo } = userStore;

  /** 显示设置密码弹窗 */
  async function showSettingPasswordDialog() {
    console.log("showSettingPasswordDialog");

    await formDialog.showModal({
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

    await formDialog.showModal({
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
        showToast(res.code, res.msg);
        if (res.code === 0) {
          userStore.setPassword("");
          userStore.clearUserInfo();
          showToast(0, $t("密码重置成功"));
          dialogRef?.close();
          setTimeout(() => {
            router.push({ name: "login" });
          });
        } else {
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
    dialogInstance.showModal({
      header: $t("修改邮箱"),
      class: "!w-[384px]",
      slots: {
        default: () => <EmailChangeDialog onSuccess={async () => {
          dialogInstance.hideModal()
          const { code, data } = await fetchUserInfo()
          if (code === 0) {
            Object.assign(currentData, data)
          }
        }} />,
        footer: undefined
      },
    });
  }

  let currentData = reactive({} as Recordable<any>)

  function getUserProfilePanels(data?: any): SettingsModule {
    currentData = reactive(data)

    return {
      title: $t("个人信息"),
      description: $t("设置您的账号信息和邮箱"),
      list: [
        {
          items: [
            {
              label: $t("个人头像"),
              text: $t("推荐尺寸为 64*64，最大不超过 2MB"),
              name: "avatar",
              classes: "flex-col !items-start gap-4",
              value: currentData?.avatar ?? "",
              props: {
                class: "resize-none w-full",
                userName: currentData.userName,
                avatarColor: currentData.avatarColor,
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
              value: currentData?.userName ?? "",
              oldValue: currentData?.userName,
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
              value: currentData?.email ?? "",
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return <div class="w-full flex gap-2 items-center justify-between">
                  {withDirectives(h("div", { class: "truncate w-[152px]" }, currentData?.email), [
                    [MyTooltip, { value: currentData?.email }, '', { top: true }]
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
      ],
    };
  }

  return {
    getUserProfilePanels,
  };
}
