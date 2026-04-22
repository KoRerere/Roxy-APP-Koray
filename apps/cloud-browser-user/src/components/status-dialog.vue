<script setup lang="ts">
import { computed } from 'vue'
import { confirmStatusDialog, statusDialogState } from '~/runtime/status-dialog'

const dialog = computed(() => statusDialogState.current)
const isPromoDialog = computed(() => dialog.value?.variant !== 'notice')
const isPending = computed(() => statusDialogState.pending)
const dialogFeatures = computed(() => dialog.value?.features ?? [])
</script>

<template>
  <Teleport to="body">
    <div v-if="dialog" class="status-dialog-backdrop" role="presentation">
      <section
        class="status-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="isPromoDialog ? 'status-dialog-title' : undefined"
        :aria-describedby="dialog.description ? 'status-dialog-description' : undefined"
      >
        <header class="status-dialog-header">
          <h2 id="status-dialog-title" class="status-dialog-title">
            {{ dialog.title }}
          </h2>
        </header>

        <div v-if="isPromoDialog" class="status-dialog-content">
          <div class="status-dialog-illustration" aria-hidden="true">
           <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" class="hourglass-icon" viewBox="0 0 120 120" fill="none">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M27.9509 86.2206C30.4842 88.3813 36.5894 91.6387 49.533 95.4139C60.9901 98.7556 68.8648 99.203 72.4128 99.1893C77.1159 100.561 80.446 101.532 80.446 101.532C80.446 101.532 79.1579 105.947 78.8874 106.874C78.027 109.824 63.555 109.802 46.9792 104.968C30.4034 100.133 18.0006 92.3163 18.8611 89.3661C19.1593 88.3436 20.4111 84.0503 20.4187 84.0243C20.4187 84.0243 23.5293 84.9309 27.9509 86.2206Z" fill="url(#paint0_linear_30661_5535)"/>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M27.6964 81.5933C27.1329 82.9591 26.8021 84.1097 26.7101 84.8813C27.9812 86.8725 33.5325 90.7479 49.5323 95.4146C65.4828 100.067 74.4904 99.1148 74.546 99.1089C74.546 99.1089 75.0569 97.7207 75.5167 95.5103C79.0476 97.7731 80.9287 99.8608 80.4796 101.402C79.3919 105.131 65.073 104.236 48.4972 99.4009C31.9213 94.5662 19.3655 87.6232 20.4532 83.894C20.899 82.3666 23.5649 81.6158 27.6964 81.5933Z" fill="url(#paint1_linear_30661_5535)"/>
  <path d="M64.919 61.7075C65.4489 59.8911 66.6009 58.6252 68.0362 57.6376C69.431 56.6778 71.1761 55.9271 72.9827 55.1686C76.6615 53.6241 80.9695 51.8943 85.0537 48.1154C87.9247 45.459 89.767 42.1224 90.7888 39.1341C91.2987 37.6429 91.5965 36.2616 91.7194 35.1249C91.7961 34.4159 91.7991 33.8474 91.7633 33.426L47.4696 20.5069C45.9966 23.3289 44.1344 29.5221 46.2773 36.7689C47.7833 41.8612 50.3786 45.4302 52.5149 48.7024C54.5862 51.8751 56.4429 55.0543 55.3191 58.9075C54.1857 62.7932 50.9242 64.2992 47.6201 65.5772C44.2022 66.8991 40.4461 68.0786 36.9769 70.9947C34.1811 73.3448 32.0036 76.2665 30.4858 78.9363C29.1546 81.2779 27.6387 83.8493 28.018 84.7243C28.3974 85.5993 30.0455 86.8676 32.9926 88.3642C36.4413 90.1153 41.7666 92.4098 49.7182 94.729C57.629 97.0364 63.9572 97.8096 68.1223 98.1428C70.2051 98.3094 71.5325 98.2257 72.5506 98.1428C72.9447 98.1107 73.4655 97.8609 73.5697 97.7359C73.6738 97.6109 73.7233 97.3631 73.7884 97.1265C74.0476 96.1839 74.3196 94.9122 74.5575 93.3003C75.0357 90.0605 75.1694 85.8452 73.8869 81.7603C72.7689 78.1991 70.2604 75.2257 67.9913 72.0261C65.8429 68.9968 63.7874 65.5875 64.919 61.7075ZM67.479 62.4542C66.7441 64.9741 67.9687 67.3829 70.1668 70.4823C72.2442 73.4115 75.1491 76.8783 76.4311 80.9615C77.8783 85.5712 77.7066 90.2296 77.1958 93.69C76.9393 95.4282 76.5939 96.8855 76.3116 97.9121C76.1704 98.4255 76.0445 98.8326 75.9526 99.1149C75.9067 99.2561 75.8686 99.3668 75.8419 99.4434C75.8286 99.4816 75.8179 99.5119 75.8103 99.5332C75.8066 99.5433 75.804 99.5516 75.8018 99.5578C75.8006 99.561 75.7979 99.5662 75.7979 99.5662L75.7969 99.57C75.6215 100.045 75.192 100.381 74.6887 100.435L74.6862 100.434L74.6748 100.436C74.6681 100.437 74.6593 100.437 74.6485 100.438C74.6261 100.44 74.5946 100.444 74.5549 100.447C74.4751 100.454 74.3602 100.463 74.2113 100.472C73.9135 100.491 73.4782 100.512 72.9099 100.521C71.7732 100.54 70.1037 100.514 67.9333 100.34C63.5916 99.993 57.2481 99.0535 49.159 96.6941C41.1108 94.3467 35.6391 92.1835 31.9944 90.3328C28.4076 88.5115 26.4251 86.912 25.5869 85.5993C25.4212 85.3396 25.3501 85.0303 25.3864 84.7243C25.5767 83.1279 26.5527 80.4581 28.167 77.6184C29.8017 74.7429 32.169 71.5527 35.2611 68.9535C39.1518 65.6831 43.4226 64.3424 46.658 63.0911C50.0072 61.7957 52.0257 60.675 52.7591 58.1608C53.5019 55.614 52.412 53.4199 50.2833 50.1593C48.2196 46.9982 45.3616 43.0734 43.7209 37.5261C41.0764 28.5841 43.8796 21.004 45.7252 18.201L45.8592 18.0298C46.198 17.6624 46.721 17.5108 47.2125 17.6541L93.2925 31.0943C93.7156 31.2177 94.0505 31.5423 94.187 31.9615C94.4813 32.8663 94.5122 34.0985 94.3703 35.4112C94.2242 36.7628 93.8795 38.3379 93.312 39.9975C92.1788 43.3116 90.1248 47.0566 86.8644 50.0731C82.3889 54.214 77.6565 56.0978 74.0155 57.6265C72.1624 58.4044 70.6782 59.0562 69.5482 59.8337C68.4584 60.5835 67.7892 61.3907 67.479 62.4542Z" fill="url(#paint2_linear_30661_5535)"/>
  <mask id="mask0_30661_5535" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="52" y="43" width="27" height="18">
    <path d="M54.6788 47.8669C52.1228 44.1492 52.2361 43.7836 53.6207 43.6403C55.0052 43.4971 60.3746 44.9175 62.754 45.6822C67.8729 47.3273 70.1006 46.3114 75.4204 47.1644C79.666 47.8451 78.8872 48.4292 78.7732 49.1436C78.6593 49.858 74.4312 52.2118 70.1006 53.7265C64.6872 55.6198 62.176 58.8481 61.5086 60.0162C61.0408 60.8347 60.1542 59.2048 59.8875 57.7381C59.6209 56.2715 58.9852 54.1305 54.6788 47.8669Z" fill="black"/>
  </mask>
  <g mask="url(#mask0_30661_5535)">
    <path d="M54.6788 47.867C51.1162 42.9389 47.5535 36.4149 48.9058 35.9587C50.2582 35.5025 53.8559 37.053 57.8025 38.7596C62.7359 40.893 70.487 45.0311 75.4203 47.1644C79.367 48.8711 78.8872 48.4292 78.7732 49.1437C78.6592 49.8581 74.4312 52.2119 70.1006 53.7265C64.6872 55.6199 62.2585 59.5561 61.5921 60.3777C60.9982 61.11 60.1542 59.2049 59.8875 57.7382C59.6209 56.2715 59.1321 54.027 54.6788 47.867Z" fill="url(#paint3_linear_30661_5535)"/>
    <path d="M53.6631 44.437C48.8676 42.4654 51.5472 40.7482 53.2905 40.9104C63.4282 42.6939 83.6952 46.6247 83.6616 48.0792C83.6196 49.8973 80.0092 50.2182 74.4244 50.3554C68.8396 50.4926 58.4586 46.4086 53.6631 44.437Z" fill="url(#paint4_linear_30661_5535)"/>
  </g>
  <path d="M64.1543 85.1236C61.5541 82.5579 58.1936 78.0411 55.7005 77.314C53.223 76.5914 51.2327 77.4081 48.3387 78.5957L48.2843 78.6181C44.6298 80.1177 38.7457 81.6023 35.1359 81.802C31.36 81.7035 29.1639 83.1298 30.5832 84.7622C31.9106 86.8643 38.9 89.9643 51.022 93.4999C63.144 97.0356 69.7087 97.1882 71.3063 96.2735C72.9038 95.3588 71.9496 92.8253 70.0813 91.0278C68.2129 89.2303 66.7546 87.6892 64.1543 85.1236Z" fill="url(#paint5_linear_30661_5535)"/>
  <path d="M98.2257 33.2275C97.4009 36.0552 84.1247 34.6702 68.5724 30.1341C53.02 25.5979 41.081 19.6284 41.9057 16.8007C42.1924 15.8178 43.3991 11.6807 43.3991 11.6807C43.3991 11.6807 61.4125 16.9346 71.5591 19.8941C82.2246 23.0049 99.719 28.1075 99.719 28.1075C99.719 28.1075 98.4849 32.339 98.2257 33.2275Z" fill="url(#paint6_linear_30661_5535)"/>
  <ellipse cx="71.5592" cy="19.8941" rx="29.3333" ry="5.33333" transform="rotate(16.2604 71.5592 19.8941)" fill="url(#paint7_linear_30661_5535)"/>
  <defs>
    <linearGradient id="paint0_linear_30661_5535" x1="6.24836" y1="81.431" x2="6.57201" y2="112.3" gradientUnits="userSpaceOnUse">
      <stop stop-color="#73C8FC"/>
      <stop offset="1" stop-color="#CCEAFC"/>
    </linearGradient>
    <linearGradient id="paint1_linear_30661_5535" x1="8.14425" y1="74.9234" x2="11.2652" y2="112.871" gradientUnits="userSpaceOnUse">
      <stop stop-color="#69C5FE"/>
      <stop offset="1" stop-color="#DCF0FC"/>
    </linearGradient>
    <linearGradient id="paint2_linear_30661_5535" x1="70.1677" y1="25.7383" x2="56.5261" y2="98.0883" gradientUnits="userSpaceOnUse">
      <stop stop-color="#D5EFFF"/>
      <stop offset="0.798077" stop-color="#9CD6FF"/>
      <stop offset="1" stop-color="#87CDFF"/>
    </linearGradient>
    <linearGradient id="paint3_linear_30661_5535" x1="64.4845" y1="40.0471" x2="58.9122" y2="59.1517" gradientUnits="userSpaceOnUse">
      <stop stop-color="#91D3FF"/>
      <stop offset="1" stop-color="#C0E7FF"/>
    </linearGradient>
    <linearGradient id="paint4_linear_30661_5535" x1="44.3501" y1="41.09" x2="50.124" y2="60.6714" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7ECCFC"/>
      <stop offset="1" stop-color="#F8FBFD"/>
    </linearGradient>
    <linearGradient id="paint5_linear_30661_5535" x1="41.2512" y1="77.7378" x2="46.1449" y2="102.245" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7ECCFC"/>
      <stop offset="1" stop-color="#D3F2FF"/>
    </linearGradient>
    <linearGradient id="paint6_linear_30661_5535" x1="30.0957" y1="9.27615" x2="30.5816" y2="38.8067" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7ECCFC"/>
      <stop offset="1" stop-color="#F0F8FD"/>
    </linearGradient>
    <linearGradient id="paint7_linear_30661_5535" x1="28.7813" y1="15.9775" x2="37.5164" y2="44.1908" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7ECCFC"/>
      <stop offset="1" stop-color="#F8FBFD"/>
    </linearGradient>
  </defs>
</svg>
          </div>

          <div class="status-dialog-copy">
            <h3 class="status-dialog-headline">
              {{ dialog.title }}
            </h3>
            <p v-if="dialog.description" id="status-dialog-description" class="status-dialog-description">
              {{ dialog.description }}
            </p>
            <ul v-if="dialogFeatures.length" class="status-dialog-features">
              <li v-for="feature in dialogFeatures" :key="feature" class="status-dialog-feature">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M8 1.333A6.667 6.667 0 1 1 8 14.667 6.667 6.667 0 0 1 8 1.333Zm3.024 3.786a.833.833 0 0 0-1.19.024L7.18 7.934 6.145 6.9a.833.833 0 0 0-1.178 1.178l1.643 1.643a.833.833 0 0 0 1.203-.012l3.236-3.4a.833.833 0 0 0-.025-1.19Z"
                    fill="#1DB954"
                  />
                </svg>
                <span>{{ feature }}</span>
              </li>
            </ul>
          </div>

          <div class="status-dialog-actions">
            <button type="button" class="status-dialog-primary" :disabled="isPending" @click="confirmStatusDialog">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8.667 1.333a.667.667 0 1 0-1.334 0v5.39L5.138 4.529a.667.667 0 0 0-.943.942l3.334 3.334a.667.667 0 0 0 .942 0l3.334-3.334a.667.667 0 0 0-.943-.942L8.667 6.724v-5.39Z"
                  fill="currentColor"
                />
                <path
                  d="M3.333 9.333a.667.667 0 0 0-1.333 0v2C2 12.438 2.895 13.333 4 13.333h8c1.105 0 2-.895 2-2v-2a.667.667 0 0 0-1.333 0v2a.667.667 0 0 1-.667.667H4a.667.667 0 0 1-.667-.667v-2Z"
                  fill="currentColor"
                />
              </svg>
              <span>{{ dialog.primaryText }}</span>
            </button>
          </div>
        </div>

        <div v-else class="status-dialog-content status-dialog-content-notice">
          <div class="status-dialog-copy">
            <p v-if="dialog.description" id="status-dialog-description" class="status-dialog-description status-dialog-description-notice">
              {{ dialog.description }}
            </p>
          </div>
          <div class="status-dialog-actions">
            <button type="button" class="status-dialog-primary" :disabled="isPending" @click="confirmStatusDialog">
              <span>{{ dialog.primaryText }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
  .status-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(17, 18, 19, 0.44);
    backdrop-filter: blur(10px);
  }

  .status-dialog {
    width: min(100%, 560px);
    border: 1px solid #afb7bb;
    border-radius: 8px;
    background: #fff;
    box-shadow:
      0 1px 1px rgba(0, 0, 0, 0.04),
      0 2px 8px rgba(0, 0, 0, 0.04),
      0 3px 17px rgba(0, 0, 0, 0.04),
      0 4px 30px rgba(0, 0, 0, 0.12);
    color: #111213;
  }

  .status-dialog-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    padding: 16px 24px 0;
  }

  .status-dialog-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: #111213;
  }

  .status-dialog-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
  }

  .status-dialog-content-notice {
    padding-top: 20px;
  }

  .status-dialog-illustration {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .hourglass-icon {
    width: 120px;
    height: 120px;
  }

  .status-dialog-copy {
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: #34393d;
  }

  .status-dialog-headline {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    line-height: 32px;
    color: #34393d;
  }

  .status-dialog-description {
    margin: 0;
    font-size: 14px;
    line-height: 22px;
    color: #575d60;
  }

  .status-dialog-description-notice {
    color: #34393d;
  }

  .status-dialog-features {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .status-dialog-feature {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: #111213;

    svg {
      width: 16px;
      height: 16px;
      flex: 0 0 auto;
    }
  }

  .status-dialog-actions {
    display: flex;
    justify-content: flex-end;
  }

  .status-dialog-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 88px;
    padding: 10px 16px;
    border: 1px solid #0282d4;
    border-radius: 8px;
    background: #11a3fd;
    box-shadow:
      0 4px 4px -1px rgba(0, 0, 0, 0.02),
      0 1px 1px rgba(0, 0, 0, 0.06);
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;

    &:hover:not(:disabled) {
      background: #0f96ea;
      border-color: #0278c5;
    }

    &:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }

    svg {
      width: 16px;
      height: 16px;
      flex: 0 0 auto;
    }
  }

  @media (max-width: 640px) {
    .status-dialog-backdrop {
      padding: 16px;
    }

    .status-dialog-header {
      padding: 16px 16px 0;
    }

    .status-dialog-content {
      padding: 20px 16px 16px;
    }

    .status-dialog-actions {
      justify-content: stretch;
    }

    .status-dialog-primary {
      width: 100%;
    }
  }
</style>
