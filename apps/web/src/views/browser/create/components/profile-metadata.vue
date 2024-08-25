<script lang="ts" setup>
const metaList = ref([
  {
    icon: 'mdi mdi-star-three-points-outline',
    label: 'Group',
    value: [],
  },
  {
    icon: 'mdi mdi-tag-outline',
    label: 'Tag',
    value: [],
  },
  {
    icon: 'mdi mdi-text-box-outline',
    label: 'Notes',
    value: [],
  },
])
</script>

<template>
  <Accordion value="0">
    <AccordionPanel value="0">
      <AccordionHeader as="div" class="accordion-header">
        Metadata
      </AccordionHeader>
      <AccordionContent>
        <div v-for="(meta, index) in metaList" :key="index" class="metadata">
          <span :class="meta.icon" />
          <span class="metadata-label">{{ meta.label }}</span>
          <span class="mdi mdi-plus cursor-pointer" />
        </div>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>

<style lang="scss" scoped>
.accordion-header {
  padding: var(--spacing-md, 6px) 8px;
  background: var(--Color-neutrals-100, #f0f3f5) !important;
  border-radius: 4px;
}

.metadata {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;

  &-label {
    flex: 1;
  }
}
</style>
