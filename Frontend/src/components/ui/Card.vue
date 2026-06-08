<script setup>
// 通用卡片容器，带 card 样式类和过渡动画
defineProps({
  class: { type: String, default: '' },
});
</script>

<template>
  <div class="card p-5 transition-colors" :class="$props.class">
    <slot />
  </div>
</template>
