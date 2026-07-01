<script setup lang="ts">
import TsFormInputTextarea from '/@/views/lab/components/form/m-input-textarea.vue'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { useFileDialog } from '@vueuse/core'

const { openType } = defineProps<{
  openType: 'user_click' | 'system_pop'
}>()

const emit = defineEmits<{
  (e: 'submit', value: 'thanks'): void
  (e: 'close'): void
}>()

const [_, onlyErrorToast] = useResponseToast()
const { mixpanelTrack } = useUserStore()
const { open, onChange } = useFileDialog({
  accept: 'image/png, image/jpeg, image/jpg, image/bmp',
  directory: false,
})
const { onboardingTaskStatus, updateOnboardingTaskStatus } = useOnboardingTaskStatus()

const STARS = 5
const IMAGE_LIMIT = 6
const IMAGE_SIZE_LIMIT = 2
const star = ref(STARS)
const reviewContent = ref()

const reviewImage = ref<{ localPath: string, displayPath: string, id: string }[]>([])

onMounted(() => {
  mixpanelTrack('review_popup_open', { review_open_type: openType })
})

onChange(async (files) => {
  if (!files?.length)
    return

  if (files[0]!.size > IMAGE_SIZE_LIMIT * 1024 * 1024) {
    onlyErrorToast(-1, $t('最大不超过 {size}', { size: `${IMAGE_SIZE_LIMIT}MB` }))
    return
  }

  const localPath = await globalThis.electronAPI.getPathForFile(files[0]!)
  if (localPath) {
    const displayPath = await globalThis.electronAPI.send('util:toMediaPath', localPath)
    displayPath && reviewImage.value.push({ localPath, displayPath, id: globalThis.crypto.randomUUID() })
  }
})

function deleteImage(id: string) {
  reviewImage.value = reviewImage.value.filter(item => item.id !== id)
}

async function submitScore() {
  const images = (await Promise.allSettled(reviewImage.value.map(item => globalThis.electronAPI.send('user:uploadReviewImage', item.localPath))))
    .map(item => item.status === 'fulfilled' ? item.value : '')
    .filter(Boolean)

  const { code, msg } = await API.base.userAppRatingCreate({ ratingStar: star.value, ratingContent: reviewContent.value, images })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

  if (onboardingTaskStatus.value?.autoRatingStatus === false) {
    updateOnboardingTaskStatus({ autoRatingStatus: true })
  }

  mixpanelTrack('review_submit_rating', { review_rating_score: star.value })
  emit('submit', 'thanks')
}
</script>

<template>
  <div class="w-120 flex flex-col pa-6 pt-4 gap-9 rounded-2 select-none popup">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('评价与反馈') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-7">
      <div class="tt-primary text-6 font-700 leading-8 text-center">
        {{ $t('反馈有奖') }}
      </div>
      <div class="flex flex-col items-center gap-3">
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
        <div class="tt-tertiary text-3.25 leading-4.5">
          {{ $t('点击星星进行评分') }}
        </div>
      </div>
      <div class="flex flex-col gap-3">
        <div class="py-2 px-3 rounded-1.5 text-white text-3.25 font-500 leading-4.5 text-center bg-gradient-to-r from-[#958cfc] to-[#f178d3]">
          {{ $t('🎉 优质反馈一经采纳，即可获得 $10 奖励') }}
        </div>
        <TsFormInputTextarea v-model="reviewContent" class="!resize-none" rows="6" size="md" :placeholder="$t('详细描述您的问题或建议，并留下联系方式（选填）')" />
        <div class="flex items-center gap-2.5">
          <div v-for="item in reviewImage" :key="item.id" class="relative w-16 aspect-square group">
            <img class="block w-full h-full object-cover rounded-2" :src="item.displayPath">
            <div class="absolute inset-0 rounded-2 bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <SvgIcon class="absolute -top-1 -right-1 cursor-pointer z-2" name="base/rx_ic_delete_fill" color="var(--colors-icon-icon-secondary)" @click="deleteImage(item.id)" />
            </div>
          </div>
          <RxButton v-if="reviewImage.length < IMAGE_LIMIT" class="!w-16" severity="secondary" size="lg" icon="base/rx_ic_plus" @click="open" />
        </div>
        <div class="flex items-center gap-1">
          <SvgIcon name="base/rx_ic_info_fill" color="var(--colors-icon-icon-info)" />
          <span class="tt-tertiary text-3 leading-5">{{ $t('最多上传 6 张图片，单张大小不超过 2MB', { count: IMAGE_LIMIT }) }}</span>
        </div>
      </div>
      <RxButton class="w-full" size="lg" :label="$t('提交反馈')" :disabled="!star" @click="submitScore" />
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
</style>
