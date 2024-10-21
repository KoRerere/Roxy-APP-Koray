<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

const message = ref('')

electronAPI.on('app:launch-message', (msg) => {
  console.log('app:launch-message: ', msg)
  message.value = msg
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
        <span class="version">Beta  v1.0.5</span>
      </div>
    </div>
    <div class="message">
      {{ message }}
    </div>

    <div class="rectangle-1" />
    <div class="rectangle-2" />
    <div class="rectangle-3" />
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
  line-height: normal;

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
    font-size: 10px;
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

.rectangle-1 {
  position: fixed;
  top: 50%;
  left: 15%;
  width: 408.089px;
  height: 618.175px;
  transform: translateY(-50%) rotate(37.7deg);
  flex-shrink: 0;
  background: linear-gradient(153deg, #bfe4ff -60.02%, #fff 76.62%);
}

.rectangle-2 {
  position: fixed;
  top: 50%;
  left: 33%;
  width: 408.089px;
  height: 618.175px;
  transform: translateY(-50%) rotate(37.7deg);
  flex-shrink: 0;
  background: linear-gradient(154deg, #8bc9f6 -76.36%, #fff 80.91%);
}

.rectangle-3 {
  position: fixed;
  top: 50%;
  left: 66%;
  width: 408.089px;
  height: 618.175px;
  transform: translateY(-50%) rotate(37.7deg);
  flex-shrink: 0;
  background: linear-gradient(153deg, rgba(27, 152, 243, 0.4) -52.67%, rgba(255, 255, 255, 0.4) 76.62%);
}
</style>
