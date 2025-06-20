import { useCommonUtil } from "./useCommonUtil";
import type {
  Items,
  SettingsModule,
} from "/@/layout/components/header/profile/type";
import { $t } from "/@/locales";
import Auth2fa from "../auth-2fa/index.vue";
import RxButton from "/@/components/rx-button";
import { RxSvgIcon } from '/@/components/rx-icon'
import { API } from "/@/api";

export const useAuthentication = () => {
  const { saveUserConfig } = useCommonUtil();

  const getAuthentication = async (data?: any): Promise<SettingsModule> => {
    const res = await API.base.userGetValidatorBindInfoList();

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
              value: false,
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return (
                  <Auth2fa
                    {...item.props}
                    {...props}
                    onChange={() => saveUserConfig(item, items)}
                  />
                );
              },
            },
            {
              label: $t("身份验证应用"),
              // hide: (item: Items, items: Items[]) => !items.find(i => i.name === "2faSwitch")?.value,
              // status/rx_ic_warn_fill
              component: ({ item, ...props }: { item: Items; props: any }) => {
                return (
                  <div class="w-full flex items-center justify-between">
                    <div class="flex items-center gap-4px">
                      <RxSvgIcon name={'status/rx_ic_check_fill'} size="16px" />
                      {$t("已配置")}
                    </div>
                    <RxButton severity="secondary" outlined>{$t('重置')}</RxButton>
                  </div>
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