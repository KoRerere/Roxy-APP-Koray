<script setup lang="ts">
const emit = defineEmits(['cancel', 'save'])

const dialogRef = inject<any>('dialogRef')

function close() {
  dialogRef.value.close()
}
const message = ref('')

function save() {
  emit('save', [message.value, close])
}
</script>

<template>
  <div>
    <div class="header">
      <div>Add notes to profile[UID-20]/[UID-21]/[UID-22]</div>
    </div>
    <span class="block mb-2">Please fill the form below to change the tab name.</span>
    <Textarea v-model="message" class="w-full" placeholder="Please add notes here" auto-resize rows="5" cols="30" />
    <span class=" text-red block mt-2">This action will overwrite all the old notes</span>
    <div class="footer">
      <Button label="Save" severity="info" autofocus @click="save" />
      <Button label="Cancel" text severity="secondary" autofocus @click="close" />
    </div>
  </div>
</template>

<style scoped></style>
