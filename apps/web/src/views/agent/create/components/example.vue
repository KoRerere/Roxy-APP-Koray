<script setup lang="tsx">
import { IPType } from '/@/enums/proxy'
import { useProxyCreateLabels } from '../proxy-create-mode'

const props = defineProps<{
  ipType?: IPType
}>()

const labels = useProxyCreateLabels()
const isDeviceMode = computed(() => labels.value.mode === 'device')

const ipv6Host = 'fe80::1:9dc0:f1ab:90a3'

function replaceRulesInto_UP(template: string) {
  return template.replace('{username}:{password}', $t('用户名:密码'))
}

function replaceRulesInto_RN(template: string) {
  // 电商模式无刷新 URL，示例中直接去掉该片段
  const withRefresh = isDeviceMode.value
    ? template.replace('[RefreshURL]', '')
    : template.replace('[RefreshURL]', `<span class="text-green whitespace-nowrap">[${$t('刷新 URL')}]</span>`)
  return withRefresh.replace('{Notes}', `<span class="text-blue whitespace-nowrap">{${$t('备注')}}</span>`)
}

function replaceRulesInto_IPV6(template: string) {
  return replaceRulesInto_UP(template.replace('[ipv6]', `<span class="text-orange">[${ipv6Host}]</span>`))
}

const rules = computed(() => {
  const refreshPart = isDeviceMode.value ? '' : '[RefreshURL]'
  const template_ipv4_a = `192.168.0.1:8000:{username}:{password}${refreshPart}{Notes}`
  const template_ipv6_a = `[ipv6]:8000:{username}:{password}${refreshPart}{Notes}`
  const template_ipv4_b = `{username}:{password}@192.168.0.1:8000${refreshPart}{Notes}`
  const template_ipv6_b = `{username}:{password}@[ipv6]:8000${refreshPart}{Notes}`
  const stripOptionalSuffix = isDeviceMode.value ? '{Notes}' : '[RefreshURL]{Notes}'
  return [
    { type: IPType.IPV4, content: replaceRulesInto_RN('192.168.0.1:8000{Notes}') },
    { type: IPType.IPV4, content: replaceRulesInto_UP(template_ipv4_a).replace(stripOptionalSuffix, '') },
    { type: IPType.IPV4, content: replaceRulesInto_RN(replaceRulesInto_UP(template_ipv4_a)) },
    { type: IPType.IPV6, content: replaceRulesInto_RN(replaceRulesInto_IPV6(template_ipv6_a)) },
    { type: IPType.IPV4, content: replaceRulesInto_UP(template_ipv4_b).replace(stripOptionalSuffix, '') },
    { type: IPType.IPV4, content: replaceRulesInto_RN(replaceRulesInto_UP(template_ipv4_b)) },
    { type: IPType.IPV6, content: replaceRulesInto_RN(replaceRulesInto_IPV6(template_ipv6_b)) },
  ]
})

const contents = computed(() => {
  if (props.ipType === IPType.IPV4) {
    return rules.value.filter(rule => rule.type === IPType.IPV4)
  }
  else {
    return rules.value
  }
})
</script>

<template>
  <div v-bind="$attrs" class="break-keep-all example">
    <div>{{ isDeviceMode ? $t('示例（备注为选填）') : $t('示例（刷新 URL 与备注为选填）') }}: </div>
    <div v-for="(rule, index) in contents" :key="index" v-html="rule.content" />
    <br>
    <div class="help">
      <span v-if="ipType === IPType.IPV6">1. </span>{{ labels.batchHelpLine }}
    </div>
    <div v-if="ipType === IPType.IPV6" class="help">
      {{ $t('2. IPV6 的主机需填写在 [ ] 内；') }}
    </div>
  </div>
</template>

<style>
.break-keep-all {
  overflow: hidden;
  word-break: break-word;
}

.break-keep-all span {
  word-break: break-word;
}

.example {
  color: var(--colors-text-text-primary);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  line-height: 20px;
}

.help {
  font-family: Inter;
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 20px;
}
</style>
