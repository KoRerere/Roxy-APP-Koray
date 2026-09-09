<script setup lang="ts">
import type { AgentAttachment } from '../types'

type FileIconType = 'audio' | 'default' | 'excel' | 'image' | 'java' | 'javascript' | 'markdown' | 'pdf' | 'ppt' | 'python' | 'video' | 'word' | 'zip'

const props = withDefaults(defineProps<{
  attachment: AgentAttachment
  previewUrl?: string
  previewable?: boolean
  removable?: boolean
  removeLabel?: string
  downloadUrl?: string
  downloadLabel?: string
  size?: 'composer' | 'message' | 'reply'
}>(), {
  previewUrl: '',
  previewable: false,
  removable: false,
  removeLabel: '',
  downloadUrl: '',
  downloadLabel: '',
  size: 'composer',
})

const emit = defineEmits<{
  preview: []
  remove: []
}>()

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'jfif'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'ape', 'aac', 'ogg'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'])

const FILE_ICON_COLORS: Record<FileIconType, string> = {
  audio: '#ff6e31',
  default: '#8c8c8c',
  excel: '#22b35e',
  image: '#8c8c8c',
  java: '#1677ff',
  javascript: '#fab714',
  markdown: '#8c8c8c',
  pdf: '#ff4d4f',
  ppt: '#ff6e31',
  python: '#fab714',
  video: '#ff4d4f',
  word: '#1677ff',
  zip: '#fab714',
}

const extension = computed(() => {
  const match = props.attachment.fileName.match(/\.([^.]+)$/)
  return match?.[1]?.toLowerCase() ?? ''
})

const fileNameParts = computed(() => {
  const match = props.attachment.fileName.match(/^(.*)\.[^.]+$/)
  return match
    ? { prefix: match[1], suffix: props.attachment.fileName.slice(match[1].length) }
    : { prefix: props.attachment.fileName, suffix: '' }
})

const isImagePreview = computed(() => props.attachment.kind === 'file'
  && Boolean(props.previewUrl)
  && (props.attachment.mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(extension.value)))

const iconType = computed<FileIconType>(() => {
  if (['xlsx', 'xls'].includes(extension.value)) {
    return 'excel'
  }
  if (IMAGE_EXTENSIONS.has(extension.value)) {
    return 'image'
  }
  if (['md', 'mdx'].includes(extension.value)) {
    return 'markdown'
  }
  if (extension.value === 'pdf') {
    return 'pdf'
  }
  if (['ppt', 'pptx'].includes(extension.value)) {
    return 'ppt'
  }
  if (['doc', 'docx'].includes(extension.value)) {
    return 'word'
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension.value)) {
    return 'zip'
  }
  if (VIDEO_EXTENSIONS.has(extension.value)) {
    return 'video'
  }
  if (AUDIO_EXTENSIONS.has(extension.value)) {
    return 'audio'
  }
  if (extension.value === 'java') {
    return 'java'
  }
  if (extension.value === 'js') {
    return 'javascript'
  }
  if (extension.value === 'py') {
    return 'python'
  }
  return 'default'
})

const iconColor = computed(() => FILE_ICON_COLORS[iconType.value])
const description = computed(() => {
  if (props.attachment.kind === 'folder') {
    return 'Folder'
  }
  return extension.value.toUpperCase() || 'FILE'
})
const isUploading = computed(() => props.attachment.uploadStatus === 'uploading')
const isError = computed(() => props.attachment.uploadStatus === 'error')

function handleCardClick() {
  if (props.previewable) {
    emit('preview')
  }
}

function handleCardKeydown(event: KeyboardEvent) {
  if (!props.previewable || (event.key !== 'Enter' && event.key !== ' ')) {
    return
  }

  event.preventDefault()
  emit('preview')
}
</script>

<template>
  <article
    class="agent-file-card"
    :class="[
      `agent-file-card--${size}`,
      {
        'agent-file-card--previewable': previewable,
        'agent-file-card--uploading': isUploading,
      },
    ]"
  >
    <div
      class="agent-file-card__file"
      :role="previewable ? 'button' : undefined"
      :tabindex="previewable ? 0 : undefined"
      @click="handleCardClick"
      @keydown="handleCardKeydown"
    >
      <div class="agent-file-card__icon" :style="{ color: iconColor }">
        <img v-if="isImagePreview" :src="previewUrl" :alt="attachment.fileName">
        <SvgIcon v-else-if="attachment.kind === 'folder'" name="roxy-agent/rx-ic-folder" size="32" color="#8c8c8c" />

        <svg v-else-if="iconType === 'audio'" viewBox="0 0 16 16" fill-rule="evenodd" aria-hidden="true">
          <path d="M14.1178571,4.0125 C14.225,4.11964286 14.2857143,4.26428571 14.2857143,4.41607143 L14.2857143,15.4285714 C14.2857143,15.7446429 14.0303571,16 13.7142857,16 L2.28571429,16 C1.96964286,16 1.71428571,15.7446429 1.71428571,15.4285714 L1.71428571,0.571428571 C1.71428571,0.255357143 1.96964286,0 2.28571429,0 L9.86964286,0 C10.0214286,0 10.1678571,0.0607142857 10.275,0.167857143 L14.1178571,4.0125 Z M10.7315824,7.11216117 C10.7428131,7.15148751 10.7485063,7.19218979 10.7485063,7.23309113 L10.7485063,8.07742614 C10.7484199,8.27364959 10.6183424,8.44607275 10.4296853,8.50003683 L8.32984514,9.09986306 L8.32984514,11.7071803 C8.32986605,12.5367078 7.67249692,13.217028 6.84345686,13.2454634 L6.79068592,13.2463395 C6.12766108,13.2463395 5.53916361,12.8217001 5.33010655,12.1924966 C5.1210495,11.563293 5.33842118,10.8709227 5.86959669,10.4741173 C6.40077221,10.0773119 7.12636292,10.0652587 7.67042486,10.4442027 L7.67020842,7.74937024 L7.68449368,7.74937024 C7.72405122,7.59919041 7.83988806,7.48101083 7.98924584,7.4384546 L10.1880418,6.81004755 C10.42156,6.74340323 10.6648954,6.87865515 10.7315824,7.11216117 Z M9.60714286,1.31785714 L12.9678571,4.67857143 L9.60714286,4.67857143 L9.60714286,1.31785714 Z" />
        </svg>
        <svg v-else-if="iconType === 'video'" viewBox="0 0 16 16" fill-rule="evenodd" aria-hidden="true">
          <path d="M14.1178571,4.0125 C14.225,4.11964286 14.2857143,4.26428571 14.2857143,4.41607143 L14.2857143,15.4285714 C14.2857143,15.7446429 14.0303571,16 13.7142857,16 L2.28571429,16 C1.96964286,16 1.71428571,15.7446429 1.71428571,15.4285714 L1.71428571,0.571428571 C1.71428571,0.255357143 1.96964286,0 2.28571429,0 L9.86964286,0 C10.0214286,0 10.1678571,0.0607142857 10.275,0.167857143 L14.1178571,4.0125 Z M12.9678571,4.67857143 L9.60714286,1.31785714 L9.60714286,4.67857143 L12.9678571,4.67857143 Z M10.5379461,10.3101106 L6.68957555,13.0059749 C6.59910784,13.0693494 6.47439406,13.0473861 6.41101953,12.9569184 C6.3874624,12.9232903 6.37482581,12.8832269 6.37482581,12.8421686 L6.37482581,7.45043999 C6.37482581,7.33998304 6.46436886,7.25043999 6.57482581,7.25043999 C6.61588409,7.25043999 6.65594753,7.26307658 6.68957555,7.28663371 L10.5379461,9.98249803 C10.6284138,10.0458726 10.6503772,10.1705863 10.5870027,10.2610541 C10.5736331,10.2801392 10.5570312,10.2967411 10.5379461,10.3101106 Z" />
        </svg>
        <svg v-else viewBox="0 0 1024 1024" aria-hidden="true">
          <path v-if="iconType === 'excel'" d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3zM790.2 326 602 137.8V326h188.2zM575.34 477.84l-61.22 102.3L452.3 477.8a12 12 0 0 0-10.27-5.79h-38.44a12 12 0 0 0-10.15 18.41l82.34 130.42-83.45 132.78a12 12 0 0 0 10.16 18.39h34.46a12 12 0 0 0 10.21-5.7l62.7-101.47 62.3 101.45a12 12 0 0 0 10.23 5.72h37.48a12 12 0 0 0 10.1-18.48l-83.83-130.55 85.3-132.47a12 12 0 0 0-10.1-18.5h-35.7a12 12 0 0 0-10.29 5.84Z" />
          <path v-else-if="iconType === 'image'" d="M854.6 288.7 639.4 73.4c-6-6-14.2-9.4-22.7-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.3c0-8.5-3.4-16.6-9.4-22.6ZM400 402a40 40 0 1 1 0 80 40 40 0 0 1 0-80Zm296 294H328c-6.7 0-10.4-7.7-6.3-12.9l99.8-127.2a8 8 0 0 1 12.6 0l41.1 52.4 77.8-99.2a8 8 0 0 1 12.6 0l136.5 174c4.3 5.2.5 12.9-6.1 12.9Zm-94-370V137.8L790.2 326H602Z" />
          <path v-else-if="iconType === 'markdown'" d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3ZM790.2 326 602 137.8V326h188.2ZM426.13 600.93l59.11 132.97a16 16 0 0 0 14.62 9.5h24.06a16 16 0 0 0 14.63-9.51l59.1-133.35V758a16 16 0 0 0 16.01 16H641a16 16 0 0 0 16-16V486a16 16 0 0 0-16-16h-34.75a16 16 0 0 0-14.67 9.62L512.1 662.2l-79.48-182.59A16 16 0 0 0 417.95 470H383a16 16 0 0 0-16 16v272a16 16 0 0 0 16 16h27.13a16 16 0 0 0 16-16V600.93Z" />
          <path v-else-if="iconType === 'pdf'" d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3ZM790.2 326 602 137.8V326h188.2Zm-157 311.26c-15.18-.5-31.32.67-49.65 2.96-24.3-14.99-40.66-35.58-52.28-65.83 6.78-27.94 11.85-52.46 7.78-82.23-3.3-18.59-16.45-29.46-33.02-30.13-15.45-.63-29.65 8-33.28 21.37-5.91 21.62-2.45 50.07 10.08 98.59-15.96 38.05-37.05 82.66-51.2 107.54-43.78 22.57-70.11 45.69-75.24 68.72-3.18 15.2 7.61 34.1 22.21 35.23 24.15 1.87 53.83-23.03 86.6-79.26 39.69-13.33 71.2-23.61 98.46-28.22 27.98 14.98 60.32 24.8 82.1 24.8 17.98 0 30.13-9.32 34.52-23.99 3.85-12.88.8-27.82-7.48-36.08-8.56-8.41-24.3-12.43-45.65-13.12Z" />
          <path v-else-if="iconType === 'ppt'" d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3ZM790.2 326 602 137.8V326h188.2ZM468.53 760v-91.54h59.27c60.57 0 100.2-39.65 100.2-98.12 0-58.22-39.58-98.34-99.98-98.34H424a12 12 0 0 0-12 12v276a12 12 0 0 0 12 12h32.53a12 12 0 0 0 12-12Zm0-139.33V520.22h52.22c31.75 0 49.87 18.07 49.87 50.12 0 37.4-19.37 50.33-67.19 50.33h-34.9Z" />
          <path v-else-if="iconType === 'word'" d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3ZM790.2 326 602 137.8V326h188.2ZM512 566.1l52.81 197a12 12 0 0 0 11.6 8.9h31.77a12 12 0 0 0 11.6-8.88l74.37-276a12 12 0 0 0-11.6-15.12h-35.57a12 12 0 0 0-11.7 9.31l-45.78 199.1-49.76-199.32A12 12 0 0 0 528.1 472h-32.2a12 12 0 0 0-11.64 9.1L434.6 680.01 388.5 481.3a12 12 0 0 0-11.68-9.29h-35.39a12 12 0 0 0-11.58 15.11l74.17 276A12 12 0 0 0 415.6 772h31.99a12 12 0 0 0 11.59-8.9L512 566.1Z" />
          <path v-else-if="iconType === 'zip'" d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3ZM790.2 326 602 137.8V326h188.2ZM296 136v64h64v-64h-64Zm64 64v64h64v-64h-64Zm-64 64v64h64v-64h-64Zm64 64v64h64v-64h-64Zm-64 64v64h64v-64h-64Zm64 64v64h64v-64h-64Zm-64 64v64h64v-64h-64Zm0 64v160h128V584H296Zm48 48h32v64h-32v-64Z" />
          <path v-else-if="iconType === 'java'" d="M394.68 756.99s-34.325 19.95 24.343 26.6c71.1 8.05 107.351 7 185.632-7.874 0 0 20.665 12.949 49.385 24.149-175.475 75.074-397.184-4.375-259.36-42.875m-21.366-98.173s-38.352 28.35 20.315 34.475c75.83 7.875 135.897 8.4 239.571-11.55 0 0 14.36 14.525 36.952 22.4-212.427 62.123-448.846 5.075-296.838-45.325m180.73-166.422c43.256 49.699-11.384 94.498-11.384 94.498s109.804-56.7 59.368-127.573c-47.11-66.15-83.185-99.049 112.255-212.273.175 0-306.819 76.65-160.24 245.348M786.26 829.439s25.393 20.825-27.846 37.1c-101.397 30.625-421.7 39.9-510.664 1.225-32.048-13.825 28.02-33.25 46.934-37.275 19.613-4.2 30.997-3.5 30.997-3.5-35.551-25.025-229.94 49.175-98.771 70.35 357.605 58.1 652.165-26.075 559.35-67.9M411.142 557.144S248.1 595.818 353.35 609.818c44.482 5.95 133.095 4.55 215.58-2.275 67.423-5.6 135.196-17.85 135.196-17.85s-23.818 10.15-40.98 21.875c-165.493 43.575-485.096 23.275-393.156-21.175 77.93-37.45 141.151-33.25 141.151-33.25M703.6 720.416c168.296-87.324 90.365-171.322 36.077-159.948-13.31 2.8-19.264 5.25-19.264 5.25s4.903-7.7 14.36-11.025c107.351-37.8 190.01 111.299-34.675 170.273 0-.175 2.627-2.45 3.502-4.55M602.028 64s93.166 93.1-88.438 236.246c-145.53 114.8-33.274 180.424 0 255.148-84.936-76.65-147.28-144.024-105.425-206.848C469.634 256.672 639.68 211.873 602.028 64M427.778 957.188C589.244 967.513 837.221 951.413 843 875.113c0 0-11.208 28.875-133.445 51.975-137.824 25.9-307.87 22.925-408.567 6.3 0-.175 20.665 16.975 126.79 23.8" />
          <path v-else-if="iconType === 'javascript'" d="M416 176H255.545v425.615c0 105.313-36.166 134.718-99.104 134.718-29.494 0-56.055-5.05-76.718-12.144L63 848.784C92.484 858.924 137.73 865 173.126 865 317.631 865 416 797.16 416 602.658V176Zm349.49-16C610.26 160 512 248.126 512 364.609c0 100.313 75.67 163.12 185.696 203.629 79.577 28.358 111.03 53.695 111.03 95.218 0 45.579-36.358 74.96-105.13 74.96-63.868 0-121.849-21.311-161.146-42.573v-.042L512 822.427C549.361 843.735 619.12 865 694.741 865 876.52 865 961 767.753 961 653.293c0-97.243-54.036-160.035-170.937-204.627-86.47-34.432-122.813-53.669-122.813-97.227 0-34.45 31.446-65.834 96.3-65.834 63.834 0 107.728 21.445 133.307 34.632L935.193 192.05C895.103 174.461 841.109 160 765.49 160Z" />
          <g v-else-if="iconType === 'python'" fill-rule="evenodd" transform="translate(112 112)">
            <path d="M443 678.5c0 15.74 12.76 28.5 28.5 28.5s28.5-12.76 28.5-28.5-12.76-28.5-28.5-28.5-28.5 12.76-28.5 28.5M300 121.5c0 15.74 12.76 28.5 28.5 28.5s28.5-12.76 28.5-28.5S344.24 93 328.5 93 300 105.76 300 121.5" />
            <path d="M709.524 185.714h-95.238V90.476C614.286 40.571 573.714 0 523.81 0H276.19c-49.904 0-90.476 40.571-90.476 90.476v95.238H90.476C40.571 185.714 0 226.286 0 276.19v247.62c0 49.904 40.571 90.476 90.476 90.476h95.238v95.238c0 49.905 40.572 90.476 90.476 90.476h247.62c49.904 0 90.476-40.571 90.476-90.476v-95.238h95.238c49.905 0 90.476-40.572 90.476-90.476V276.19c0-49.904-40.571-90.476-90.476-90.476M90.476 557.143c-18.38 0-33.333-14.953-33.333-33.333V276.19c0-18.38 14.952-33.333 33.333-33.333h278.572c15.81 0 28.571-12.762 28.571-28.571 0-15.81-12.762-28.572-28.571-28.572h-126.19V90.476c0-18.38 14.952-33.333 33.332-33.333h247.62c18.38 0 33.333 14.952 33.333 33.333v256.476c0 13.524-10.953 24.477-24.476 24.477H267.333c-45.047 0-81.619 36.666-81.619 81.619v104.095zm652.381-33.333c0 18.38-14.952 33.333-33.333 33.333H430.952c-15.81 0-28.571 12.762-28.571 28.571 0 15.81 12.762 28.572 28.571 28.572h126.19v95.238c0 18.38-14.952 33.333-33.332 33.333H276.19c-18.38 0-33.333-14.952-33.333-33.333V453.048c0-13.524 10.953-24.477 24.476-24.477h265.334c45.047 0 81.619-36.666 81.619-81.619V242.857h95.238c18.38 0 33.333 14.953 33.333 33.333z" />
          </g>
          <path v-else d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3ZM790.2 326 602 137.8V326h188.2ZM320 482a8 8 0 0 0-8 8v48a8 8 0 0 0 8 8h384a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8H320Zm0 136a8 8 0 0 0-8 8v48a8 8 0 0 0 8 8h184a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8H320Z" />
        </svg>
      </div>

      <div class="agent-file-card__content">
        <div class="agent-file-card__name" :title="attachment.fileName">
          <span class="agent-file-card__name-prefix">{{ fileNameParts.prefix }}</span>
          <span class="agent-file-card__name-suffix">{{ fileNameParts.suffix }}</span>
        </div>
        <div class="agent-file-card__description" :class="{ 'agent-file-card__description--error': isError }">
          {{ description }}
        </div>
      </div>

      <span v-if="isUploading" class="agent-file-card__spinner" aria-hidden="true" />

      <a
        v-if="downloadUrl"
        class="agent-file-card__mask"
        :href="downloadUrl"
        :download="attachment.fileName"
        :aria-label="downloadLabel"
        @click.stop
      >
        <span class="agent-file-card__mask-info">
          <svg viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8ZM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8Z" />
          </svg>
          <span>{{ downloadLabel }}</span>
        </span>
      </a>
    </div>

    <button
      v-if="removable"
      type="button"
      class="agent-file-card__remove"
      :aria-label="removeLabel"
      @click.stop="emit('remove')"
    >
      <SvgIcon name="roxy-agent/rx-ic-close2" size="12" color="currentColor" />
    </button>
  </article>
</template>

<style lang="scss" scoped>
.agent-file-card {
  position: relative;
  display: flex;
  max-width: 100%;

  &--composer {
    width: 128px;
    min-width: 128px;
  }

  &--message {
    width: 160px;
  }

  &--reply {
    width: 260px;
  }

  &--uploading {
    opacity: 0.75;
  }
}

.agent-file-card__file {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  padding: 8px;
  border-radius: 8px;
  color: inherit;
  background: var(--color-bg-tertiary);
  box-sizing: border-box;
  text-align: left;
}

.agent-file-card--previewable .agent-file-card__file {
  cursor: zoom-in;
  transition: background-color 0.2s;

  &:hover,
  &:focus-visible {
    background: var(--color-bg-tertiary-hover);
    outline: 2px solid var(--color-border-primary);
    outline-offset: -2px;
  }
}

.agent-file-card__icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  margin-inline-end: 8px;
  overflow: hidden;
  border-radius: 4px;
  font-size: 36px;

  svg {
    display: block;
    width: 36px;
    height: 36px;
    fill: currentColor;
  }

  img {
    display: block;
    width: 36px;
    height: 36px;
    object-fit: cover;
  }
}

.agent-file-card--composer .agent-file-card__icon {
  width: 40px;
  height: 40px;
  flex-basis: 40px;

  svg {
    width: 36px;
    height: 36px;
  }

  img {
    width: 40px;
    height: 40px;
  }
}

.agent-file-card--composer .agent-file-card__content {
  max-width: calc(100% - 48px);
}

.agent-file-card--reply .agent-file-card__file {
  padding: 12px 16px;
}

.agent-file-card--reply .agent-file-card__icon {
  margin-inline-end: 8px;
}

.agent-file-card__content {
  min-width: 0;
  flex: 1;
  max-width: calc(100% - 44px);
}

.agent-file-card__name {
  display: flex;
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 20px;
}

.agent-file-card__name-prefix {
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-file-card__name-suffix {
  flex: none;
}

.agent-file-card__description {
  min-height: 20px;
  overflow: hidden;
  margin-bottom: 2px;
  color: var(--color-text-disabled);
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;

  &--error {
    color: var(--color-text-error-primary);
  }
}

.agent-file-card__spinner {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  margin-inline-start: 6px;
  border: 2px solid var(--color-border-secondary);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: agent-file-card-spin 0.8s linear infinite;
}

.agent-file-card__mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgb(0 0 0 / 50%);
  cursor: pointer;
  opacity: 0;
  text-decoration: none;
  transition: opacity 0.3s;

  &:hover,
  &:focus-visible {
    opacity: 1;
    outline: none;
  }
}

.agent-file-card__mask-info {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;

  svg {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    fill: currentColor;
  }
}

.agent-file-card__remove {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  display: grid;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
  cursor: pointer;
  opacity: 0;
  place-items: center;
  transform: translate(50%, -50%);
  transition: opacity 0.2s;
}

.agent-file-card:hover .agent-file-card__remove,
.agent-file-card:focus-within .agent-file-card__remove,
.agent-file-card__remove:focus-visible {
  opacity: 1;
}

@keyframes agent-file-card-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
