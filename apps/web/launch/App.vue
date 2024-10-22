<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

const message = ref('')
const appVersion = ref('')

electronAPI.on('app:launch-message', (msg) => {
  console.log('app:launch-message: ', msg)
  message.value = msg
})

electronAPI.send('app:getAppVersion').then((version) => {
  appVersion.value = version
})
</script>

<template>
  <div class="launch">
    <div class="copyright">
      <RxSvgIcon name="base/logo" class="logo" size="42px" />
      <div>
        <div class="product-name">
          RoxyBrowser
        </div>
        <span class="version">v{{ appVersion }}</span>
      </div>
    </div>
    <div class="message">
      {{ message }}
    </div>

    <div class="bg" />
    <div class="bg bg2" />
    <div class="bg bg3" />
  </div>
</template>

<style lang="scss" scoped>
.launch {
  width: 100vw;
  height: 100vh;
  border-radius: var(--radius-3xl, 16px);
  background: linear-gradient(180deg, #f2fbff 0%, #fff 100%);

  /* shadow-sm */
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
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
    font-family: Archivo;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
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
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  z-index: 10;
}

.bg {
  animation: slide 10s ease-in-out infinite alternate;
  background-image: linear-gradient(-30deg, rgba(193, 235, 255, 0.5) 50%, rgba(255, 255, 255, 0.4) 50%);
  bottom: 0;
  left: -50%;
  opacity: 0.6;
  position: absolute;
  right: -50%;
  top: 0;
  z-index: 0;
}

.bg2 {
  animation-direction: alternate-reverse;
  animation-duration: 20s;
}

.bg3 {
  animation-duration: 30s;
}

@keyframes slide {
  0% {
    transform: translateX(-25%);
  }
  100% {
    transform: translateX(25%);
  }
}
</style>
