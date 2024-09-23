<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div>
    某个项目 {{ route.params.id }}
  </div>
</template>
