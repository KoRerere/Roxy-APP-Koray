<template>
  <div class="rightMenu" v-show="showMenu">
    <ul>
      <li v-for="(menu, index) in menus" @click="() => menu.click(data)" :key="index">
        <span style="margin-left: 10px;">{{ menu.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { ref, defineProps, defineExpose } from 'vue';

interface Menu {
  name: string;
  click: (data: any) => void;
}

const props = defineProps<{
  menus: Menu[];
}>();

const showMenu = ref(false);
const data = ref(null)


function close() {
  showMenu.value = false;
}

function open(row: any, event: MouseEvent) {
  event.preventDefault();
  showMenu.value = false;
  data.value = row
  const menu = document.querySelector('.rightMenu') as HTMLElement;
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  showMenu.value = true;
  document.addEventListener('click', close);
}

defineExpose({ open, close });
</script>

<style scoped>
.rightMenu {
  position: fixed;
  z-index: 99999999;
  cursor: pointer;
  border: 1px solid #eee;
  box-shadow: 0 0.5em 1em 2px rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  color: #606266;
  font-size: 14px;
  background: #fff;
}

.rightMenu ul {
  list-style: none;
  margin: 0;
  padding: 0;
  border-radius: 6px;
}

.rightMenu ul li {
  padding: 6px 10px;
  border-bottom: 1px solid #c8c9cc;
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.rightMenu ul li:last-child {
  border: none;
}

.rightMenu ul li:hover {
  background: #EBEEF5;
}
</style>
