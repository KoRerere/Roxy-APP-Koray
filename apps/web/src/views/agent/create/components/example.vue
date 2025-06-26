<script setup lang="tsx">
import { ParseMode, IPType } from "/@/utils"
import { $t } from '/@/locales'

const props = defineProps<{
  parserType: ParseMode
  ipType?: IPType
}>()

const ipv6Host = 'fe80::1:9dc0:f1ab:90a3'

function replaceRulesInto_UP(template: string) {
  return template.replace('{username}:{password}', $t('用户名:密码'))
}

function replaceRulesInto_RN(template: string) {
  return template.replace('{Notes}',
    `<span class="text-blue whitespace-nowrap">{${$t('备注')}}</span>`
  ).replace('[RefreshURL]',
    `<span class="text-green whitespace-nowrap">[${$t('刷新 URL')}]</span>`
  )
}

function replaceRulesInto_IPV6(template: string) {
  return replaceRulesInto_UP(template.replace('[ipv6]', `<span class="text-orange">[${ipv6Host}]</span>`))
}

const rules = computed(() => {
  if (props.parserType === ParseMode.one) {
    const template_ipv4 = '192.168.0.1:8000[RefreshURL]{Notes}';
    const template_ipv6 = '[ipv6]:8000[RefreshURL]{Notes}';
    return [
      { type: IPType.IPV4, content: template_ipv4.replace('[RefreshURL]{Notes}', "") },
      { type: IPType.IPV4, content: replaceRulesInto_RN(template_ipv4) },
      { type: IPType.IPV6, content: replaceRulesInto_RN(replaceRulesInto_IPV6(template_ipv6)) }
    ]
  } else if (props.parserType === ParseMode.two) {
    const template_ipv4 = '192.168.0.1:8000:{username}:{password}[RefreshURL]{Notes}';
    const template_ipv6 = '[ipv6]:8000:{username}:{password}[RefreshURL]{Notes}';
    return [
      { type: IPType.IPV4, content: replaceRulesInto_UP(template_ipv4).replace('[RefreshURL]{Notes}', "") },
      { type: IPType.IPV4, content: replaceRulesInto_RN(replaceRulesInto_UP(template_ipv4)) },
      { type: IPType.IPV6, content: replaceRulesInto_RN(replaceRulesInto_IPV6(template_ipv6)) }
    ]
  } else if (props.parserType === ParseMode.three) {
    const template_ipv4 = '{username}:{password}@192.168.0.1:8000[RefreshURL]{Notes}';
    const template_ipv6 = '{username}:{password}@[ipv6]:8000[RefreshURL]{Notes}';
    return [
      { type: IPType.IPV4, content: replaceRulesInto_UP(template_ipv4).replace('[RefreshURL]{Notes}', "") },
      { type: IPType.IPV4, content: replaceRulesInto_RN(replaceRulesInto_UP(template_ipv4)) },
      { type: IPType.IPV6, content: replaceRulesInto_RN(replaceRulesInto_IPV6(template_ipv6)) }
    ]
  } else {
    return [];
  }
})

const contents = computed(() => {
  if (props.ipType === IPType.IPV4) {
    return rules.value.filter(rule => rule.type === IPType.IPV4);
  } else {
    return rules.value;
  }
})

</script>

<template>
  <div v-bind="$attrs" class="break-keep-all font-[JetBrains_Mono]">
    <div>{{ $t('示例') }}: </div>
    <div v-for="rule in contents" v-html="rule.content" class="text-[var(--colors-text-text-primary)]"></div>
    <br />
    <div class="font-[Inter]">
      <span v-if="ipType === IPType.IPV6">1. </span>{{ $t('一行一个代理，一次最多添加 500 个；') }}
    </div>
    <div v-if="ipType === IPType.IPV6" class="font-[Inter]">
      {{ $t('2. IPV6 的主机需填写在 [ ] 内；') }}
    </div>
  </div>
</template>

<style>
.break-keep-all {
  overflow: hidden;
  /* word-break: break-word; */
  word-break: break-word;
}

.break-keep-all span {
  word-break: break-word;
}
</style>