<script setup lang="ts">
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { openType } = defineProps<{
  openType: 'user_click' | 'system_pop'
}>()

const emit = defineEmits<{
  (e: 'submit', value: 'reward' | 'thanks'): void
  (e: 'close'): void
}>()

const { mixpanelTrack } = useUserStore()
const { onboardingTaskStatus, updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const [_, onlyErrorToast] = useResponseToast()

const star = ref(0)
const STARS = 5

onMounted(() => {
  mixpanelTrack('review_popup_open', { review_open_type: openType })
  if (onboardingTaskStatus.value?.autoRatingStatus === false) {
    updateOnboardingTaskStatus({ autoRatingStatus: true })
  }
})

async function submitScore() {
  const { code, msg } = await API.base.userAppRatingCreate({ ratingStar: star.value })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  const [scoreFmt, step, params] = star.value < STARS
  // 非五星评分允许重新评5星领取奖励
    ? ['1_4_star', 'thanks', { ratingStatus: true, externalRatingStatus: false }]
    : ['5_star', onboardingTaskStatus.value?.ratingStatus ? 'thanks' : 'reward', { externalRatingStatus: true, ratingStatus: !!onboardingTaskStatus.value?.ratingStatus }]

  mixpanelTrack('review_submit_rating', { review_rating_score: scoreFmt })

  updateOnboardingTaskStatus(params)
  emit('submit', step as 'thanks' | 'reward')
}
</script>

<template>
  <div class="w-110 inline-flex flex-col items-center gap-8 pa-6 pt-12 rounded-2 select-none popup">
    <div class="flex flex-col gap-2 items-center">
      <img draggable="false" class="w-20 aspect-square" src="/images/logo_3.svg">
      <div class="text-center title">
        {{ $t('您对我们的产品满意吗？') }}
      </div>
      <div class="text-center desc">
        {{ $t('请为我们打分') }}
      </div>
    </div>
    <Rating v-model="star" :stars="STARS" :pt="{ root: '!gap-2.5', officon: '!w-8 !h-8', onicon: '!w-8 !h-8' }">
      <template #officon>
        <div class="w-8 h-8 pa-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="25" viewBox="0 0 26 25" fill="none">
            <path opacity="0.36"
                  d="M10.7207 1.18576C11.4255 -0.395211 13.6695 -0.395212 14.3742 1.18576L16.498 5.95023C16.7886 6.60229 17.4048 7.04998 18.1148 7.12492L23.3024 7.67243C25.0237 7.85411 25.7172 9.98831 24.4313 11.1471L20.5563 14.6392C20.026 15.1171 19.7906 15.8415 19.9388 16.5399L21.0211 21.6427C21.3802 23.336 19.5648 24.655 18.0654 23.7902L13.5467 21.184C12.9283 20.8273 12.1667 20.8273 11.5482 21.184L7.0296 23.7902C5.53019 24.655 3.71473 23.336 4.07387 21.6427L5.1562 16.5399C5.30432 15.8415 5.06896 15.1171 4.53863 14.6392L0.66363 11.1471C-0.622196 9.98832 0.0712469 7.85411 1.79261 7.67243L6.98017 7.12492C7.69014 7.04998 8.30633 6.60229 8.59699 5.95023L10.7207 1.18576Z"
                  fill="#AFB7BB"
            />
          </svg>
        </div>
      </template>
      <template #onicon>
        <div class="w-8 h-8 pa-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="25" viewBox="0 0 26 25" fill="none">
            <path opacity="0.9"
                  d="M10.7207 1.18576C11.4255 -0.395211 13.6695 -0.395212 14.3742 1.18576L16.498 5.95023C16.7886 6.60229 17.4048 7.04998 18.1148 7.12492L23.3024 7.67243C25.0237 7.85411 25.7172 9.98831 24.4313 11.1471L20.5563 14.6392C20.026 15.1171 19.7906 15.8415 19.9388 16.5399L21.0211 21.6427C21.3802 23.336 19.5648 24.655 18.0654 23.7902L13.5467 21.184C12.9283 20.8273 12.1667 20.8273 11.5482 21.184L7.0296 23.7902C5.53019 24.655 3.71473 23.336 4.07387 21.6427L5.1562 16.5399C5.30432 15.8415 5.06896 15.1171 4.53863 14.6392L0.66363 11.1471C-0.622196 9.98832 0.0712469 7.85411 1.79261 7.67243L6.98017 7.12492C7.69014 7.04998 8.30633 6.60229 8.59699 5.95023L10.7207 1.18576Z"
                  fill="#FD9F12"
            />
          </svg>
        </div>
      </template>
    </Rating>
    <div class="w-full flex flex-col gap-3">
      <RxButton size="lg" :label="$t('提交评分')" :disabled="!star" @click="submitScore" />
      <RxButton size="lg" variant="outlined" severity="secondary" :label="$t('稍后再说')" @click="$emit('close')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  background-color: var(--colors-background-bg-page);
  background-image: url('/images/score-bg.png');
  background-size: 100% auto;
  background-repeat: no-repeat;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-style: normal;
  font-weight: 700;
  line-height: 36px;
}

.desc {
  color: var(--colors-text-text-placeholder);
  font-size: 13px;
  line-height: 18px;
}
</style>
