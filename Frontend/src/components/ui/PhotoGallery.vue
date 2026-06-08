<script setup>
// 可折叠图库：点击按钮展开/收起图片网格
// 通过插槽自定义触发按钮的内容
import { ref } from 'vue';
import GalleryImage from './GalleryImage.vue';

const props = defineProps({
  images: { type: Array, default: () => [] },
  // images: [{ src, alt, caption }]
});

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}
</script>

<template>
  <div>
    <button
      @click="toggle"
      class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer"
      style="color: var(--text-secondary); background: var(--bg-secondary); border: 1px solid var(--border-color);"
    >
      <slot name="trigger" />
    </button>
    <!-- 展开后显示 2-3 列图片网格 -->
    <div v-if="isOpen" class="mt-3">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <GalleryImage
          v-for="(img, i) in images"
          :key="i"
          :src="img.src"
          :alt="img.alt"
          :caption="img.caption"
        />
      </div>
    </div>
  </div>
</template>
