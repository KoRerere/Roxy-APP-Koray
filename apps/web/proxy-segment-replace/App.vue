<script setup lang="ts">
import type { UserGetProxySegmentReplaceListListData, UserGetUserInfoListData } from '@roxy/backend-api'
import { useToast } from 'primevue/usetoast'
import { API } from './api'
import LiveChat from './live-chat.vue'
import PageBackground from './PageBackground.vue'
import PageHeader from './PageHeader.vue'
import { usePageMessages } from './usePageMessages'
import RxToastHeadless from '/@/components/business/global-component/rx-toast-headless.vue'
import { copyText } from '/@/utils'

type ReplaceItem = UserGetProxySegmentReplaceListListData['data']['list'][number]

const messages = usePageMessages()
const toast = useToast()

const loading = ref(false)
const errorMessage = ref('')
const list = ref<ReplaceItem[]>([])
const userInfo = ref<UserGetUserInfoListData['data'] | null>(null)

/** 展示 IP，无 host 时回退为占位符 */
function formatIp(host?: string) {
  return host || messages.value.emptyCell
}

async function fetchUserInfo() {
  try {
    const { code, data } = await API.base.userGetUserInfoList()
    if (code === 0)
      userInfo.value = data
  }
  catch (err) {
    console.error('[ProxySegmentReplace] fetch user info failed', err)
  }
}

async function fetchList() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { code, data, msg } = await API.userGetProxySegmentReplaceList.userGetProxySegmentReplaceListList()

    if (code !== 0) {
      errorMessage.value = msg || messages.value.loadFailed
      list.value = []
      return
    }

    list.value = data?.list ?? []
  }
  catch (err) {
    console.error('[ProxySegmentReplace] fetch list failed', err)
    errorMessage.value = messages.value.networkError
    list.value = []
  }
  finally {
    loading.value = false
  }
}

async function copyNewIp(item: ReplaceItem) {
  const text = item.newHost

  if (!text)
    return

  try {
    await copyText(text)
    toast.add({
      severity: 'success',
      summary: $t('操作成功'),
      detail: $t('复制成功'),
      life: 2500,
    })
  }
  catch (err) {
    console.error('[ProxySegmentReplace] copy ip failed', err)
    toast.add({
      severity: 'error',
      summary: $t('操作失败'),
      detail: messages.value.copyFailed,
      life: 3000,
    })
  }
}

function openLiveChat() {
  globalThis.showLiveChat?.()
}

onMounted(() => {
  fetchUserInfo()
  fetchList()
})
</script>

<template>
  <div class="proxy-segment-replace-page">
    <RxToastHeadless />

    <PageBackground />

    <div class="page-shell">
      <PageHeader :user-info="userInfo" />

      <main class="page-main">
        <section class="announcement-card">
          <div class="announcement-text">
            <div class="announcement-meta">
              <span class="announcement-badge">{{ messages.serviceChangeBadge }}</span>
              <span class="announcement-date">{{ messages.publishedAt }}</span>
            </div>

            <h1 class="announcement-title">
              {{ messages.announcementTitle }}
            </h1>

            <div class="announcement-divider" />

            <div class="announcement-body">
              <p v-if="messages.salutation" class="announcement-salutation">
                {{ messages.salutation }}
              </p>
              <div class="announcement-paragraphs">
                <p
                  v-for="(paragraph, index) in messages.paragraphs"
                  :key="index"
                  class="announcement-paragraph"
                >
                  {{ paragraph }}
                </p>
              </div>
            </div>
          </div>

          <div class="announcement-divider" />

          <section class="replace-table-section">
            <h2 class="replace-table-title">
              {{ messages.tableTitle }}
            </h2>

            <div v-if="loading" class="replace-table-state">
              {{ messages.loading }}
            </div>

            <div v-else-if="errorMessage" class="replace-table-state replace-table-state--error">
              {{ errorMessage }}
            </div>

            <div v-else-if="!list.length" class="replace-table-state">
              {{ messages.emptyList }}
            </div>

            <div v-else class="replace-table">
              <div class="replace-table__head">
                <div class="replace-table__col replace-table__col--ip">
                  {{ messages.tableColIpChange }}
                </div>
                <div class="replace-table__col replace-table__col--expire">
                  {{ messages.tableColExpireChange }}
                </div>
              </div>

              <div
                v-for="(item, index) in list"
                :key="`${item.oldHost}-${item.newHost}-${index}`"
                class="replace-table__row"
              >
                <div class="replace-table__col replace-table__col--ip">
                  <div class="ip-change-cell">
                    <div class="ip-endpoint ip-endpoint--old">
                      <SvgIcon name="country-code/US" :size="18" />
                      <span>{{ formatIp(item.oldHost) }}</span>
                    </div>
                    <SvgIcon
                      name="base/rx_ic_play"
                      :size="14"
                      color="var(--colors-icon-icon-success, #1dc94d)"
                      class="ip-arrow"
                    />
                    <div class="ip-endpoint ip-endpoint--new">
                      <SvgIcon name="country-code/US" :size="18" />
                      <span>{{ formatIp(item.newHost) }}</span>
                      <button
                        type="button"
                        class="copy-btn"
                        :aria-label="messages.copyNewIp"
                        @click="copyNewIp(item)"
                      >
                        <SvgIcon name="base/rx_ic_copy" :size="16" color="var(--colors-icon-icon-secondary)" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="replace-table__col replace-table__col--expire">
                  <div class="expire-change-cell">
                    <span class="expire-date expire-date--old">{{ item.oldExpireDate || messages.emptyCell }}</span>
                    <SvgIcon
                      name="base/rx_ic_play"
                      :size="14"
                      color="var(--colors-icon-icon-success, #1dc94d)"
                      class="ip-arrow"
                    />
                    <span class="expire-date expire-date--new">{{ item.newExpireDate || messages.emptyCell }}</span>
                    <span class="expire-badge">{{ messages.expireExtendBadge }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section class="contact-card">
          <p class="contact-text">
            {{ messages.contactHint }}
          </p>
          <RxButton
            :label="messages.contactButton"
            icon="base/rx_ic_headphone_2"
            size="sm"
            @click="openLiveChat"
          />
        </section>
      </main>
    </div>

    <LiveChat :user-name="userInfo?.userName" />
  </div>
</template>

<style lang="scss" scoped>
.proxy-segment-replace-page {
  position: relative;
  min-height: 100vh;
  background: #f5fbff;
  color: #111213;
  font-size: 16px;
  line-height: 1.5;
}

.page-shell {
  position: relative;
  z-index: 1;
}

.page-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.announcement-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 32px;
  background: #fff;
  border: 1px solid #e2e9ee;
  border-radius: 16px;
}

.announcement-text {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.announcement-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.announcement-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border: 1px solid #fec66d;
  border-radius: 50px;
  background: #fff4e1;
  color: #fd9f12;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.announcement-date {
  color: #7d8387;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}

.announcement-title {
  margin: 0;
  color: #111213;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.4;
}

.announcement-divider {
  height: 1px;
  background: #e2e9ee;
}

.announcement-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.announcement-salutation {
  margin: 0;
  color: #111213;
  font-size: 16px;
  line-height: 1.5;
}

.announcement-paragraphs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.announcement-paragraph {
  margin: 0;
  color: #111213;
  font-size: 16px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.replace-table-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.replace-table-title {
  margin: 0;
  color: #111213;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
}

.replace-table-state {
  padding: 32px 16px;
  text-align: center;
  color: #7d8387;
  font-size: 14px;

  &--error {
    color: #f53838;
  }
}

.replace-table {
  overflow: hidden;
  border: 1px solid #f3f3f3;
  border-radius: 8px;
}

.replace-table__head,
.replace-table__row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-left: 24px;
}

.replace-table__head {
  height: 44px;
  padding-right: 40px;
  background: #f1f5f8;
  border-bottom: 1px solid #f3f3f3;
  color: #111213;
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: -0.039px;
}

.replace-table__row {
  height: 66px;
  background: #fff;
  border-bottom: 1px solid #f3f3f3;
  color: #111213;
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;

  &:last-child {
    border-bottom: 0;
  }
}

.replace-table__col {
  flex-shrink: 0;

  &--ip {
    width: 320px;
  }

  &--expire {
    flex: 1;
    min-width: 240px;
  }
}

.ip-change-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ip-endpoint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;

  &--old {
    color: #7d8387;
  }

  &--new {
    color: #111213;
  }
}

.ip-arrow {
  flex-shrink: 0;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.expire-change-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.expire-date {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;

  &--old {
    color: #7d8387;
    opacity: 0.6;
  }

  &--new {
    color: #111213;
  }
}

.expire-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 80px;
  background: #e9fceb;
  color: #1dc94d;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  white-space: nowrap;
}

.contact-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 80px;
  padding: 24px;
  background: #fff;
  border: 1px solid #e2e9ee;
  border-radius: 12px;
  box-shadow:
    0 4px 4px -1px rgb(0 0 0 / 2%),
    0 1px 1px 0 rgb(0 0 0 / 6%);
}

.contact-text {
  margin: 0;
  color: #34393d;
  font-family: Inter, system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

@media (max-width: 768px) {
  .page-main {
    padding: 24px 16px 40px;
  }

  .announcement-card {
    padding: 20px 16px;
  }

  .announcement-title {
    font-size: 22px;
  }

  .replace-table {
    overflow-x: auto;
  }

  .replace-table__head,
  .replace-table__row {
    min-width: 720px;
  }

  .contact-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<style lang="scss">
html.proxy-segment-replace-scroll,
html.proxy-segment-replace-scroll body {
  height: auto;
  min-height: 100svh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

html.proxy-segment-replace-scroll #app {
  min-height: 100svh;
}
</style>
