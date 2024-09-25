<script setup lang="ts">
const inputs = [
  {
    label: 'Email address',
    help: '',
    value: 'iamhandian@gmail.com',
    disabled: true,
  },
  {
    label: 'Username',
    help: 'Usually used in teamworks and members.',
    value: 'username',
  },
]
</script>

<template>
  <div class="w-full">
    <div>Profile</div>
    <div>Manage your account info and email.</div>
    <div>Profile picture</div>
    <div>Picture resolution should be 64px*64px and less than 2MB</div>
    <div class="upload-area">
      11
    </div>
    <div v-for="input in inputs" :key="input.label" class="inputs">
      <div class="inputs-label">
        {{ input.label }}
      </div>
      <div class="inputs-help">
        {{ input.help }}
      </div>
      <InputText v-model="input.value" class="inputs-input" type="text" :disabled="input.disabled" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.upload-area {
  display: flex;
  height: 200px;
  justify-content: center;
  align-items: center;
  gap: 10px;
  align-self: stretch;
  border-radius: var(--radius-md, 6px);
  background: var(--Color-neutrals-100, #f0f3f5);
}

.inputs {
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 220px;
  grid-template-areas:
    'left-top right'
    'left-bottom right';
  margin-top: var(--spacing-4xl, 24px);

  &-label {
    grid-area: left-top;
    color: #000;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }

  &-help {
    grid-area: left-bottom;
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-size: 10px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-input {
    grid-area: right;
    width: 100%;
  }
}
</style>
