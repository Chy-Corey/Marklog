<script setup>
// 标签胶囊组件，使用全局 .tag-pill 样式
defineProps({
  tag: { type: String, required: true },
});
</script>

<template>
  <span class="tag-pill">{{ tag }}</span>
</template>
