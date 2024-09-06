<template>
  <p-dialog :visible="visible" :modal="modal" :draggable="draggable" :closable="closable" :maximizable="maximizable"
    :responsive="responsive" :style="dialogStyle" :class="customClass" :showHeader="showHeader" :header="header"
    :footer="footer" @hide="onHide" @show="onShow">
    <template v-if="$slots.header">
      <slot name="header"></slot>
    </template>
    <template v-if="$slots.default">
      <slot name="default"></slot>
    </template>
    <template v-if="$slots.footer">
      <slot name="footer"></slot>
    </template>
  </p-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSlots } from 'vue';
import pDialog from 'primevue/dialog';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  modal: {
    type: Boolean,
    default: true
  },
  draggable: {
    type: Boolean,
    default: true
  },
  closable: {
    type: Boolean,
    default: true
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  maximizable: {
    type: Boolean,
    default: false
  },
  responsive: {
    type: Boolean,
    default: true
  },
  header: {
    type: String,
    default: ''
  },
  footer: {
    type: String,
    default: ''
  },
  customClass: {
    type: String,
    default: ''
  },
  dialogStyle: {
    type: Object,
    default: () => ({})
  }
});

// Emit
const emit = defineEmits(['update:visible']);

// Slots
const slots = useSlots();

// Local state
const visible = ref(props.visible);

// Watch for changes in the prop
watch(() => props.visible, (newValue) => {
  visible.value = newValue;
});

// Update the prop when the visibility changes
const onHide = () => {
  emit('update:visible', false);
};

const onShow = () => {
  emit('update:visible', true);
};
</script>