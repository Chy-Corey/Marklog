<script setup>
// 基础布局：侧边栏 + 主内容区 + 底部
// 顶部固定栏包含主题切换按钮，使用毛玻璃效果
import Sidebar from '../components/sidebar/Sidebar.vue';
import ThemeToggle from '../components/sidebar/ThemeToggle.vue';
import Footer from '../components/Footer.vue';
import ImageLightbox from '../components/ui/ImageLightbox.vue';
</script>

<template>
  <div class="flex">
    <Sidebar />

    <main class="flex-1 min-h-screen ml-0 lg:ml-64">
      <!-- 顶部固定栏：毛玻璃效果背景 -->
      <div
        class="sticky top-0 z-20 flex items-center justify-end px-6 py-3"
        style="background-color: color-mix(in srgb, var(--bg-primary) 85%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);"
      >
        <ThemeToggle />
      </div>

      <!-- 页面内容区，最大宽度 4xl 居中 -->
      <div class="max-w-4xl mx-auto px-6 py-6 lg:py-10">
        <slot />
      </div>

      <Footer />
    </main>

    <!-- 全局图片灯箱，通过 window.__lightbox 触发 -->
    <ImageLightbox />
  </div>
</template>
