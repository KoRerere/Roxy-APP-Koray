<script setup lang="ts">
import Accordion, { type AccordionProps } from 'primevue/accordion';

interface Props extends /* @vue-ignore */ AccordionProps { }
defineProps<Props>();

</script>


<template>
  <Accordion>
    <template #collapseicon>
      <!-- 占位用注释 -->
    </template>
    <template #expandicon>
      <!-- 占位用注释 -->
    </template>
    <slot></slot>
  </Accordion>
</template>