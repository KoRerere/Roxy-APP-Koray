<script setup lang="ts">
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { RxSvgIcon } from '/@/components/rx-icon'

defineProps({
  winInfo: {
    type: Object as PropType<UnwrapRowType<UserGetWindowInfoV2ListData>>,
    default: () => ({}),
  },
})
</script>

<template>
  <div class="two-factor-auth">
    <div class="box">
      <div class="platform-info">
        <RxSvgIcon name="websites/rx_site_facebook" class="platform-icon" />
        <div class="platform-account">
          <a href="https://www.facebook.com" target="_blank" class="platform-url">
            https://www.facebook.com
          </a>
          <div class="account-text">
            johndoe@roxybrowser.com
          </div>
        </div>
        <a href="https://www.facebook.com" target="_blank">
          <RxSvgIcon name="base/rx_ic_outlink" />
        </a>
      </div>
      <div class="two-factor">
        <RxSvgIcon name="base/rx_ic_2fa" />
        <div class="code">
          0798 6374
        </div>
        <div class="" />
      </div>
    </div>

    <div class="box">
      <div class="platform-info">
        <RxSvgIcon name="websites/rx_site_facebook" class="platform-icon" />
        <div class="platform-account">
          <a href="https://www.facebook.com" target="_blank" class="platform-url">
            https://www.facebook.com
          </a>
          <div class="account-text">
            johndoe@roxybrowser.com
          </div>
        </div>
        <a href="https://www.facebook.com" target="_blank">
          <RxSvgIcon name="base/rx_ic_outlink" />
        </a>
      </div>
      <div class="two-factor">
        <RxSvgIcon name="base/rx_ic_2fa" />
        <div class="code">
          0798 6374
        </div>
        <div class="" />
      </div>
    </div>

    <div class="link">
      <RxSvgIcon name="base/rx_ic_link" />
      <a href="https://www.google.com" target="_blank">
        https://www.google.com
      </a>
    </div>
    <div class="link">
      <RxSvgIcon name="base/rx_ic_link" />
      <a href="https://www.google.com" target="_blank">
        https://www.google.com
      </a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.two-factor-auth {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
.box {
  display: flex;
  padding: var(--spacing-xl, 12px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  border-radius: var(--radius-lg, 8px);
  border: 0.5px solid var(--Color-neutrals-100, #f0f3f5);
  background: var(--Color-neutrals-50, #fafbfc);

  .platform-info {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md, 6px);
    align-self: stretch;

    .platform-account {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-sm, 4px);
      flex: 1 0 0;

      .platform-url {
        flex: 1 0 0;
        color: var(--Colors-Text-text-primary, #171c1f);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-lg, 20px); /* 142.857% */
        text-decoration-line: underline;
      }

      .account-text {
        align-self: stretch;
        color: var(--Colors-Text-text-primary, #171c1f);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 16px; /* 133.333% */
      }
    }
  }

  .two-factor {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 6px);
    align-self: stretch;

    .code {
      flex: 1 0 0;
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 24px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-3xl, 30px); /* 125% */
    }
  }
}

.link {
  display: flex;
  padding-left: var(--spacing-xs, 2px);
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;

  color: var(--Colors-Text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
}
</style>
