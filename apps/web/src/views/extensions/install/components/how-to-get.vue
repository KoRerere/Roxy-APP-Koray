<script setup lang="ts">



const descriptions: any = [
  $t('RoxyBrowser 通过遵循 Google Chrome 官方制定的扩展程序分发与更新规范来获取.crx 安装文件。'),
  $t('根据 Chrome 扩展的 Manifest 文件格式官方文档(1)，所有发布在 Chrome 应用商店的扩展程序，其更新服务均由 Google 官方的更新服务器(后台地址为 https://clients2.google.com/service/update2/crx)统一管理。RoxyBrowser 通过向此官方服务发送一个标准化的更新检查请求(包含目标扩展程序的唯一ID)，模拟浏览器获取最新、最安全官方扩展包的过程。此操作符合 Chrome 扩展分发指南(2)中的更新机制。'),
]

</script>

<template>
  <RxAccordion>
    <AccordionPanel value="111" :pt="{ root: panel.root }">
      <AccordionHeader v-slot="{ active }" as="div" :pt="{ root: '!py-3 !px-4' }">
        <div class="flex items-center gap-2.5">
          <SvgIcon :class="{ 'rotate-90': active }" class="transition-transform duration-300" name="base/rx_ic_play" size="10" />
          <span class="title">{{ $t('RoxyBrowser 如何获取扩展？') }}</span>
        </div>
      </AccordionHeader>
      <AccordionContent>
        <div class="w-full flex flex-col gap-2.5 pl-5">
          <div v-for="item in descriptions" :key="item" class="desc">{{ item }}</div>
          <div class="desc">(1) Manifest file format: <a class="link" target="_blank"
              href="https://developer.chrome.com/docs/extensions/reference/manifest/">https://developer.chrome.com/docs/extensions/reference/manifest/</a>(update_url)</div>
          <div class="desc">(2) Distribute your extension: <a class="link" target="_blank"
              href="https://developer.chrome.com/docs/extensions/how-to/distribute/">https://developer.chrome.com/docs/extensions/how-to/distribute/</a></div>
          <div class="desc">{{ $t('注意事项：部分不符合 Chrome 最新实践的扩展即便可以通过此方式获取，也可能无法在较高的内核版本中启用，与官方规则保持一致。') }}</div>
        </div>
      </AccordionContent>
    </AccordionPanel>
  </RxAccordion>
</template>

<style scoped module="panel">
.root {
  border: none;
  border-radius: 6px;
  background: var(--colors-background-bg-block);
}
</style>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-family: 'Microsoft YaHei UI';
  font-size: 12px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-family: 'Microsoft YaHei UI';
  font-size: 12px;
  line-height: normal;
  word-break: break-all;
}

.link {
  color: var(--colors-text-text-brand);
}
</style>
