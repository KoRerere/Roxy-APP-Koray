<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

const message = ref('')
const appVersion = ref('')
const isShowTrafficLight = ref(false)

electronAPI.on('app:launch-message', (msg) => {
  console.log('app:launch-message: ', msg)
  message.value = msg
})

electronAPI.send('app:getAppVersion').then((version) => {
  appVersion.value = version
})

watch(isShowTrafficLight, (val) => {
  electronAPI.send('app:showHideTrafficLight', val)
})
</script>

<template>
  <div class="launch">
    <div class="drag-bar" @mouseover="isShowTrafficLight = true" @mouseout="isShowTrafficLight = false" />
    <div class="copyright">
      <RxSvgIcon name="base/logo" class="logo" size="42px" />
      <div>
        <div class="product-name">
          RoxyBrowser
        </div>
        <span class="version">
          v{{ appVersion }}
        </span>
      </div>
    </div>
    <div class="message">
      {{ message }}
    </div>

    <div class="wave wave1" />
    <div class="wave wave2" />
    <div class="wave wave3" />
    <div class="launch-mask" />
  </div>
</template>

<style lang="scss" scoped>
.launch {
  width: 100vw;
  height: 100vh;
  border-radius: var(--radius-3xl, 16px);
  background: radial-gradient(circle at top, #bbe1ed, #fff);
  background-size: 100% 100%;

  /* shadow-sm */
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}

.drag-bar {
  position: relative;
  width: 100%;
  height: 30px;
  z-index: 1000;
  -webkit-app-region: drag;
}

.copyright {
  position: fixed;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  display: flex;
  gap: 12px;
  line-height: 0.7;

  .product-name {
    color: #042144;
    font-family: Archivo;
    font-size: 24px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }

  .version {
    color: var(--Color-neutrals-800, #252a2e);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;

    .beta {
      font-family: Archivo;
    }
  }
}

.message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--Colors-Text-text-tertiary, #7c8387);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  z-index: 10;
}

.launch-mask {
  width: 100%;
  height: 100vh;
  position: absolute;
  left: 0;
  background: linear-gradient(rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, 1) 100%);
}

.wave {
  background-image: linear-gradient(-60deg, rgba(193, 235, 255, 0.5) 50%, rgba(255, 255, 255, 0.4) 50%);
  position: absolute;
  z-index: 0;
  top: 0;
  bottom: 0;
  opacity: 0.6;
}

.wave1 {
  animation: slide 15s ease-in-out infinite alternate;
  left: -50%;
  right: -50%;
}

.wave2 {
  animation: slide 10s ease-in-out infinite alternate-reverse;
  left: -80%;
  right: -70%;
}

.wave3 {
  animation: slide3 20s ease-in-out infinite alternate;
  left: -50%;
  right: -50%;
}

@keyframes slide {
  0% {
    transform: translateX(-20%);
  }

  100% {
    transform: translateX(20%);
  }
}

@keyframes slide3 {
  0% {
    transform: translateX(-10%);
  }

  50% {
    transform: translateX(10%);
  }

  100% {
    transform: translateX(-10%);
  }
}
</style>
