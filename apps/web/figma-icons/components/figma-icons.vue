<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { RxSvgIcon, svgIcons, type SvgNames } from '/@/components/rx-icon/'
import { copyText } from '/@/utils/'

const toast = useToast()
const currentIcon = ref<SvgNames>()

const svgModules = Object.keys(svgIcons).reduce((acc, key) => {
  const path = key.split('assets/images/').at(1)!.replace('.svg', '') as SvgNames

  const [dirname, filename] = path.split('/')

  if (filename) {
    acc[dirname] ??= []
    acc[dirname].push({
      path,
      filename,
    })
  }
  // 其他图标
  else {
    // acc['其他'] ??= []
    // acc['其他'].push({
    //   path,
    //   filename: dirname,
    // })
  }

  return acc
}, {} as Record<string, { path: SvgNames, filename: string }[]>)
console.log('svgIcons', svgIcons)
console.log('svgModules', svgModules)

function handleCopyText(text: SvgNames) {
  currentIcon.value = text
  copyText(text)
  toast.add({
    severity: 'success',
    summary: '复制成功',
    detail: text,
    life: 2000,
  })
}
</script>

<template>
  <div class="h-[100vh] flex flex-col">
    <Card class="mx-12 my-5">
      <template #title>
        使用说明
      </template>
      <template #content>
        <div class="flex justify-between">
          <div>
            <div>点击图标即可复制图标名称</div>
            <pre v-pre class="m-0 h-[80px]">
          <code>
import { RxSvgIcon } from '/@/components/rx-icon/'
&lt;RxSvgIcon name="文件夹名称/文件名称" /&gt;
          </code>
        </pre>
          </div>
          <div v-if="currentIcon">
            当前选中的图标： <RxSvgIcon :name="currentIcon" />
            <pre class="m-0 h-[80px]">
          <code>
&lt;RxSvgIcon name="{{ currentIcon }}" /&gt;
          </code>
        </pre>
          </div>
        </div>
      </template>
    </Card>
    <div class="overflow-auto">
      <template v-for="(list, key) in svgModules" :key="key">
        <Card class="mx-12 my-5">
          <template #title>
            {{ key }}（{{ list.length }}）
          </template>
          <template #content>
            <div class="flex flex-wrap gap-4 text-center">
              <template v-for="item in list" :key="item.path">
                <div class="cursor-pointer" :title="item.filename" @click="handleCopyText(item.path)">
                  <RxSvgIcon :name="item.path" />
                <!-- <div>{{ item.filename }}</div> -->
                </div>
              </template>
            </div>
          </template>
        </Card>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
</style>
