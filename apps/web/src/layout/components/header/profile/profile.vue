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
    <div class="title">
      Profile
    </div>
    <div class="description">
      Manage your account info and email.
    </div>
    <div class="sub-title">
      Profile picture
    </div>
    <div class="sub-description">
      Picture resolution should be 64px*64px and less than 2MB
    </div>
    <div class="upload-area">
      <img class="upload-area-avatar" src="https://via.placeholder.com/64x64">
      <div class="upload-area-buttons">
        <RyButton outlined severity="secondary" size="small" icon="base/rx_ic_delete" label="Remove" />
        <RyButton outlined severity="secondary" size="small" icon="base/rx_ic_export" label="Upload" />
      </div>
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
.title {
  color: #000;
  font-size: 18px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xl, 24px);
}

.description {
  color: var(--Colors-Text-text-secondary, #575d61);
  font-size: 12px;
  line-height: normal;
}

.sub-title {
  margin-top: var(--oversize-spacing-3rem, 48px);
  color: #000;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.sub-description {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-size: 10px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.upload-area {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  height: 200px;
  border-radius: var(--radius-md, 6px);
  background: var(--Color-neutrals-100, #f0f3f5);

  &-avatar {
    width: 100px;
    aspect-ratio: 1;
    border-radius: 50%;
  }

  &-buttons {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    gap: 8px;
  }
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
