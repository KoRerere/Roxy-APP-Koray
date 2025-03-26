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

const router = useRouter();
const dialog = useDialog();
const userStore = useUserStore();
const simpleLocale = useSimpleLocale();
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
          command: async () => {
            await API.base.userSetUserConfigCreate({ language: item.locale });
            simpleLocale.setSimpleLocale(item.locale);
            electronAPI.send("app:saveSoftConfig", { language: item.locale });
          },
        };
      }),
    },
    {
      separator: true,
    },
    ...(import.meta.env.DEV
      ? [
        {
          label: "图标(仅开发)",
          icon: "base/rx_ic_outlink",
          command: () => {
            window.open("/figma-icons");
          },
        },
        {
          label: "多语言(仅开发)",
          icon: "base/rx_ic_outlink",
          command: () => {
            window.open("/__language-localization__");
          },
        },
        {
          label: "实验室(仅开发)",
          icon: "base/rx_ic_doc_api",
          command: () => {
            router.push({ name: "cattle-slaughter" });
          },
        },
      ]
      : []),
    {
      label: $t("退出登录"),
      icon: "base/rx_ic_logout",
      command: () => {
        showPageLoading()
        userStore.clearUserInfo();
        router.push({ name: "login" });
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
          <RxSvgIcon v-if="simpleLocale.currentLocale === item.locale" class="ml-auto" name="base/rx_ic_check" />
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
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  margin-top: var(--spacing-sm, 4px);
  color: var(--Colors-Text-text-tertiary, #7c8387);
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
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  &:not(:disabled):hover {
    color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
    background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #f0f3f5);

    svg {
      color: var(--Component-Colors-Buttons-Secondary-text-hover, #343a3d);
    }
  }
}

.menu-label {
  color: var(--Colors-Text-text-primary, #171C1F);
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
