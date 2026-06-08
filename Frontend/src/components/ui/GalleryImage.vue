<script setup>
// 图库单张图片组件：原生懒加载 + 悬停时放大效果 + 底部字幕滑入
defineProps({
  caption: { type: String, default: '' },
  src: { type: String, required: true },
  alt: { type: String, default: '' },
});
</script>

<template>
  <div class="relative group overflow-hidden rounded-lg" style="border: 1px solid var(--border-color);">
    <!-- loading="lazy" 实现图片懒加载，靠近视口时才请求 -->
    <img
      :src="src"
      :alt="alt"
      class="w-full aspect-[4/4] object-cover transition-transform duration-300 group-hover:scale-110"
      loading="lazy"
    />
    <!-- 字幕：默认透明，悬停时从底部滑入 -->
    <div
      v-if="caption"
      class="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-medium text-white bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    >
      {{ caption }}
    </div>
  </div>
</template>
