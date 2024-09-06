<script setup lang="ts">
import { useUserStore } from '/@/stores/user'

const { userInfo } = useUserStore()
</script>

<template>
  <div>个人信息</div>
  <div>
    <p>用户名: {{ userInfo.userName }}</p>
  </div>
</template>
