<script setup>
// 全屏图片灯箱：通过 window.__lightbox.open(src, alt) 全局调用
// 使用 Teleport 将 DOM 渲染到 body 下，避免 z-index 问题
// 支持点击背景关闭、ESC 键关闭、滚动锁定
import { ref, onUnmounted } from 'vue';

const el = ref(null);
const isOpen = ref(false);
const imgSrc = ref('');
const imgAlt = ref('');

function open(src, alt) {
  imgSrc.value = src;
  imgAlt.value = alt;
  isOpen.value = true;
  document.body.style.overflow = 'hidden';
}

function close() {
  isOpen.value = false;
  document.body.style.overflow = '';
  imgSrc.value = '';
  imgAlt.value = '';
}

// 点击背景遮罩关闭
function onBackdrop(e) {
  if (e.target === e.currentTarget) close();
}

// ESC 键关闭：注册在 window 上，避免焦点问题
function onKeydown(e) {
  if (e.key === 'Escape' && isOpen.value) close();
}

window.addEventListener('keydown', onKeydown);

// 组件卸载时清理，防止页面滚动被永久锁定 + 事件监听器泄漏
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});

// 挂载到 window 上，方便任何组件直接调用
if (typeof window !== 'undefined') {
  window.__lightbox = { open, close };
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="lightbox-backdrop"
      @click="onBackdrop"
      @keydown="onKeydown"
      tabindex="0"
    >
      <div class="lightbox-content">
        <button class="lightbox-close" @click="close">&times;</button>
        <img :src="imgSrc" :alt="imgAlt" @click.stop />
      </div>
    </div>
  </Teleport>
</template>
