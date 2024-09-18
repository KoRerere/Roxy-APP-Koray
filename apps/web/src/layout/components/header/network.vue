<script setup lang="ts">

</script>

<template>
  <div class="network">
    <ry-button icon="base/rx_ic_route" outlined size="small" />
    <div class="info">
      <span class="city">HongKong</span>
      <span class="ip">Local IP Address</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.network {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 4px);

  .info {
    display: flex;
    width: 70px;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm, 4px);

    .city {
      color: #000;
      font-family: Inter;
      font-size: 10px;
      font-style: normal;
      font-weight: 500;
      line-height: 12px; /* 120% */
    }

    .ip {
      color: rgba(0, 0, 0, 0.4);
      font-family: Inter;
      font-size: 8px;
      font-style: normal;
      font-weight: 500;
      line-height: 10px; /* 125% */
    }
  }
}
</style>
