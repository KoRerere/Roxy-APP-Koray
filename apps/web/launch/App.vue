<script setup lang="ts">
const message = ref('')
const appVersion = ref('')

globalThis.electronAPI.on('app:launch-message', (msg) => {
  console.log('app:launch-message: ', msg)
  message.value = msg
})

globalThis.electronAPI.send('app:getAppVersion').then((version) => {
  appVersion.value = version
})
</script>

<template>
  <div class="launch">
    <div class="drag-bar" />
    <div class="copyright">
      <svg width="42" height="42" class="logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="lumi-logo 1">
          <g id="rect1">
            <path id="path4" d="M8.875 3.375H23.125C26.172 3.375 28.625 5.828 28.625 8.875V23.125C28.625 26.172 26.172 28.625 23.125 28.625H8.875C5.828 28.625 3.375 26.172 3.375 23.125V8.875C3.375 5.828 5.828 3.375 8.875 3.375Z" fill="white" />
            <path id="path5" d="M8.875 3.125C5.69383 3.125 3.125 5.69383 3.125 8.875V23.125C3.125 26.3062 5.69383 28.875 8.875 28.875H23.125C26.3062 28.875 28.875 26.3062 28.875 23.125V8.875C28.875 5.69383 26.3062 3.125 23.125 3.125H8.875ZM8.875 3.625H23.125C26.0378 3.625 28.375 5.96218 28.375 8.875V23.125C28.375 26.0378 26.0378 28.375 23.125 28.375H8.875C5.96218 28.375 3.625 26.0378 3.625 23.125V8.875C3.625 5.96218 5.96218 3.625 8.875 3.625Z" fill="#D4DADD" />
          </g>
          <path id="path1" d="M10.6061 16.2529C14.5051 8.83131 18.6501 3.49782 21.6465 0.562347C22.1854 0.0344398 23.0088 0.631787 22.7875 1.35294C21.1133 6.80748 19.9575 15.4412 19.4408 19.5892C19.3856 20.0327 18.9515 20.3232 18.5199 20.207L11.5216 18.3228C10.6242 18.0812 10.1739 17.0757 10.6061 16.2529Z" fill="#7EC9FF" />
          <path id="path2" d="M16.9537 19.9272C16.8762 14.8672 17.3755 10.7436 17.9108 7.96631C18.1376 6.79007 19.5784 6.51545 20.2336 7.51826C22.2944 10.6721 23.6756 13.8463 24.3816 16.7594C24.5257 17.3538 24.2533 17.9641 23.7324 18.2847L19.1474 21.1064C18.1968 21.6914 16.9709 21.0433 16.9537 19.9272Z" fill="#1A93EB" />
          <path id="path3" d="M6.10319 19.7249C5.5541 19.2312 6.04389 18.3337 6.75618 18.5283L24.5649 23.395C25.2985 23.5955 25.4755 24.555 24.8616 25.004C24.0037 25.6315 22.9649 25.9629 21.902 25.948L13.8888 25.836C13.2411 25.827 12.6187 25.5833 12.1371 25.1502L6.10319 19.7249Z" fill="#1B5BBC" />
        </g>
      </svg>

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
