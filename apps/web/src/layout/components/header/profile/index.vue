<script setup lang="tsx">
import { useDialog } from "primevue/usedialog";
import { useToast } from "primevue/usetoast";
import { useTemplateRef, withModifiers } from "vue";
import { API } from "/@/api";
import RxAvatar from "/@/components/rx-avatar";
import { RxSvgIcon, type SvgNames } from "/@/components/rx-icon/";
import { ISO639List } from "/@/constants/iso-639";
import { $t } from "/@/locales";
import { useSimpleLocale } from "/@/stores/locale";
import { useUserStore } from "/@/stores/user";
import { copyText, showPageLoading } from "/@/utils";
import { getSettings } from "./components/settings-popup";
import SettingsPopup from "./components/settings-popup.vue";
import { getColorSchemeList, useThemeStore } from "/@/stores/theme";

const router = useRouter();
const dialog = useDialog();
const userStore = useUserStore();
const simpleLocale = useSimpleLocale();
const themeStore = useThemeStore()
const styles = useCssModule();
const toast = useToast();

const menuRef = useTemplateRef("menu");

const Identity = () => {
  const { identityInfo } = userStore;
  if (!identityInfo.icon) return null;

  return (
    <div class={styles.identity}>
      <RxSvgIcon name={identityInfo.icon} />
      <span
        class={styles["identity-name"]}
        style={{ color: identityInfo.color }}
      >
        {identityInfo.text}
      </span>
    </div>
  );
};

const items = computed(() => {
  return [
    {
      render: () => {
        return (
          <div class="w-full">
            <div class={styles["user-info"]}>
              <div class={styles["user-name"]}>
                {userStore.userInfo.userName}
              </div>
              <Identity />
            </div>
            <div class={styles["user-email"]}>{userStore.userInfo.email}</div>
          </div>
        );
      },
      command: copyUserInfo,
    },
    {
      separator: true,
      // vIf: () => userStore.userInfo.identity !== 'agent',
    },
    ...getSettings().map((item) => ({
      ...item,
      command: () => openSettings(item.name),
    })),
    {
      label: $t("语言"),
      icon: "base/rx_ic_language",
      items: ISO639List.map((item) => {
        return {
          ...item,
          isCheck: () => simpleLocale.currentLocale === item.locale,
          command: async () => {
            await API.base.userSetUserConfigCreate({ language: item.locale });
            simpleLocale.setSimpleLocale(item.locale);
            electronAPI.send("app:saveSoftConfig", { language: item.locale });
          },
        };
      }),
    },
    {
      label: $t("主题模式"),
      icon: "base/rx_ic_contrast",
      items: getColorSchemeList().map((item) => {
        return {
          ...item,
          isCheck: () => themeStore.theme === item.value,
          command: async () => {
            await API.base.userSetUserConfigCreate({ colorScheme: item.value });
            themeStore.setTheme(item.value);
          },
        };
      }),
    },
    {
      separator: true,
    },
    {
      label: "图标(仅开发)",
      icon: "base/rx_ic_outlink",
      vIf: () => import.meta.hot,
      command: () => {
        window.open("/figma-icons");
      },
    },
    {
      label: "多语言(仅开发)",
      icon: "base/rx_ic_outlink",
      vIf: () => import.meta.hot,
      command: () => {
        window.open("/__language-localization__");
      },
    },
    {
      label: "实验室(仅开发)",
      icon: "base/rx_ic_doc_api",
      vIf: () => import.meta.hot,
      command: () => {
        router.push({ name: "cattle-slaughter" });
      },
    },
    {
      label: $t("退出登录"),
      icon: "base/rx_ic_logout",
      command: () => {
        showPageLoading()
        router.push({ name: "login" }).finally(() => {
          userStore.clearUserInfo()
        });
      },
    },
  ].filter((item) => !item.vIf || item.vIf());
});

function copyUserInfo() {
  copyText(`${userStore.userInfo.userName}\n${userStore.userInfo.email}`);
  toast.add({
    severity: "success",
    summary: $t("提示"),
    detail: $t("用户名与邮箱已复制到剪贴板"),
    life: 2500,
  });
}

function openSettings(activeKey: string) {
  dialog.open(SettingsPopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
      dismissableMask: true,
      style: {
        width: "var(--width-1_5xl, 960px)",
        height: "640px",
      },
      pt: { content: "!pa-0 !overflow-y-hidden" },
    },
    data: {
      props: {
        activeKey,
      },
    },
  });
}

function toggle(event: Event) {
  menuRef.value?.toggle(event);
  userStore.fetchUserInfo();
}
</script>

<template>
  <div class="settings cursor-pointer" @click="toggle">
    <template v-if="userStore.userInfo">
      <RxAvatar class="pointer-events-none" :avatar="userStore.userInfo.avatar"
        :name="userStore.userInfo.userName?.slice(0, 2)" :color="userStore.userInfo.avatarColor" :size="20"
        :font-size="12">
        <RxSvgIcon v-if="userStore.identityInfo.icon" :name="userStore.identityInfo.iconSmall"
          class="absolute right-[-4px] bottom-[-2px]" size="12px" />
      </RxAvatar>
      <span class="username" :style="{ color: userStore.identityInfo.color }">{{ userStore.userInfo.userName }}</span>
    </template>
    <RxSvgIcon class="pointer-events-none" name="base/rx_ic_chevron_down" :size="12" />
  </div>

  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <TieredMenu ref="menu" :model="items" popup :pt="{ root: 'w-[240px]' }">
    <template #item="{ item, props, hasSubmenu }">
      <a v-ripple class="flex items-center" v-bind="props.action">
        <component :is="item.render" v-if="item.render" />
        <template v-else>
          <RxSvgIcon :name="(item.icon as SvgNames)" />
          <span class="menu-label">{{ item.label }}</span>
          <RxSvgIcon v-if="hasSubmenu" class="ml-auto" name="base/rx_ic_chevron_right" />
          <RxSvgIcon v-if="item.isCheck?.()" class="ml-auto" name="base/rx_ic_check" />
        </template>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss" module>
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-name {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  margin-top: var(--spacing-sm, 4px);
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.identity {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.identity-name {
  font-family: "DingTalk JinBuTi";
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>

<style lang="scss" scoped>
.username {
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}

.settings {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  align-items: center;
  gap: var(--spacing-md, 6px);
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--colors-border-border-base, #AFB7BB);
  background: var(--colors-background-bg-action, #FFF);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  &:not(:disabled):hover {
    color: var(--colors-text-text-primary, #111213);
    background: var(--colors-background-bg-action-hover, #F1F5F8);

    svg {
      color: var(--colors-text-text-primary, #111213);
    }
  }
}

.menu-label {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
