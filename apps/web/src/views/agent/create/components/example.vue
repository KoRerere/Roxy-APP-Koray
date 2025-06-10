<script setup lang="ts">
import { ParseMode, IPType } from "/@/utils"
import { $t } from '/@/locales'

defineProps<{
  parserType: ParseMode
  ipType: IPType
}>()

</script>

<template>
  <div v-bind="$attrs">
    <div>{{ $t('示例') }}: </div>
    <div v-if="parserType === ParseMode.one" class="text-[var(--colors-text-text-primary)]">
      192.168.0.1:8000<span class="text-green">[{{ $t('刷新 URL') }}]</span><span class="text-blue">{{
        `\{${$t('备注')}\}`
      }}</span>
      <br />
      <div v-if="ipType === IPType.IPV6">
        <span class="text-orange">
          {{ $t('[fe80::451f:9dc0:f1ab:90a3]') }}
        </span>:8000<span class="text-green">[{{ $t("刷新 URL") }}]</span>
        <span class="text-blue">{{ `\{${$t('备注')}\}` }}</span>
      </div>
    </div>

    <div v-else-if="parserType === ParseMode.two" class="text-[var(--colors-text-text-primary)]">
      <div>
        <span>192.168.0.1:8000:{{ $t('用户名:密码') }}<span class="text-green">[{{ $t('刷新 URL') }}]</span><span
            class="text-blue">{{ `\{${$t('备注')}\}` }}</span></span>
      </div>

      <div v-if="ipType === IPType.IPV6">
        <span class="text-orange">[fe80::451f:9dc0:f1ab:90a3]</span>:8000:{{ $t('用户名:密码') }}<span class="text-green">[{{
          $t('刷新 URL')
        }}]</span>
        <span class="text-blue">{{ `\{${$t('备注')}\}` }}</span>
      </div>
    </div>

    <div v-else class="text-[var(--colors-text-text-primary)]">
      <div>
        <span>{{ $t('用户名:密码') }}@</span>192.168.0.1:8000<span class="text-green">[{{ $t('刷新 URL')
        }}]</span><span class="text-blue">{{ `\{${$t('备注')}\}` }}</span>
      </div>

      <div v-if="ipType === IPType.IPV6">
        {{ $t('用户名:密码') }}@<span class="text-orange">[fe80::451f:9dc0:f1ab:90a3]</span>:8000<span class="text-green">[{{
          $t('刷新 URL')
        }}]</span>
        <span class="text-blue">{{ `\{${$t('备注')}\}` }}</span>
      </div>
    </div>

    <br />
    <div>
      <span v-if="ipType === IPType.IPV6">1. </span>一行一个代理，一次最多添加 500 个；
    </div>
    <div v-if="ipType === IPType.IPV6">
      2. IPV6 的主机需填写在 [ ] 内；
    </div>
  </div>
</template>
