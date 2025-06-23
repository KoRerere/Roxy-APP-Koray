import type {
  Items,
  SettingsModule,
} from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import Auth2fa from "../auth-2fa/index.vue";
import { API } from "/@/api";
import Edit2FA from "../auth-2fa/edit-2fa.vue";
import ViewRecoveryCodes from "../auth-2fa/view-recovery-codes.vue";
import ViewRecoveryEmail from "../auth-2fa/view-recovery-email.vue";

export const useAuthentication = () => {
  const enabled = ref(false);
  const recoverCode = ref(false);
  const recoverEmail = ref(false);

  const getAuthentication = async (): Promise<SettingsModule> => {
    const res = await API.base.userGetValidatorBindInfoList({})
    let enabledDefault = res.data.validatorIsBind === 1;
    enabled.value = enabledDefault;
    recoverCode.value = res.data.recoverCode === 1;
    recoverEmail.value = res.data.recoverEmail === 1;

    const items = reactive({
      title: $t("验证"),
      description: $t("管理您的密码和身份验证。"),
      list: [
        {
          subtitle: $t("双因素身份验证"),
          items: [
            {
              label: $t("登录时使用 2FA"),
              name: "2faSwitch",
              value: enabled,
              component: ({ item }: { item: Items; props: any }) => {
                return (
                  <Auth2fa
                    defaultValue={enabledDefault}
                    modelValue={item.value}
                    onChange={(val: 'code' | 'email' | 'close') => {
                      if (val === 'code') {
                        recoverCode.value = true
                      }
                      if (val === 'email') {
                        recoverEmail.value = true
                      }
                      if (val === 'close') {
                        enabledDefault = false
                      }
                    }}
                  />
                );
              },
            },
            {
              label: $t("身份验证应用"),
              hide: (item: Items, items: Items[]) => !items.find(i => i.name === "2faSwitch")?.value,
              // status/rx_ic_warn_fill
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return (
                  <Edit2FA />
                );
              },
            },
            {
              label: $t("恢复代码"),
              value: recoverCode,
              hide: (item: Items, items: Items[]) => !item.value || !enabled.value,
              // status/rx_ic_warn_fill
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return (
                  <ViewRecoveryCodes />
                );
              },
            },
            {
              label: $t("恢复邮箱"),
              value: recoverEmail,
              hide: (item: Items, items: Items[]) => !item.value || !enabled.value,
              // status/rx_ic_warn_fill
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return (
                  <ViewRecoveryEmail />
                );
              },
            },
          ],
        },
      ],
    });

    return items;
  };

  return {
    getAuthentication,
  };
}