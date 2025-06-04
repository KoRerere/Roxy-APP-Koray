<script>

</script>

<template>
  <RxTooltip trigger="click" placement="top">
    <RxButton>上</RxButton>
    <template #content>
      <div>123</div>
    </template>
  </RxTooltip>

  <RxTooltip trigger="click" placement="bottom">
    <RxButton>下</RxButton>
    <template #content>
      <div>123</div>
    </template>
  </RxTooltip>

  <RxTooltip trigger="click" placement="left">
    <RxButton>左</RxButton>
    <template #content>
      <div>123</div>
    </template>
  </RxTooltip>

  <RxTooltip trigger="click" placement="right">
    <RxButton>右</RxButton>
    <template #content>
      <div>123</div>
    </template>
  </RxTooltip>

  <div />

  <RxTooltip trigger="hover" placement="top">
    <RxButton>hover</RxButton>
    <template #content>
      <div>good tooltip</div>
    </template>
  </RxTooltip>
</template>
