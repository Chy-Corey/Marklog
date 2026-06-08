<script setup>
// 主题切换按钮：在亮色/暗色模式之间切换
// 亮色模式显示月亮图标，暗色模式显示太阳图标
import { useTheme } from '../../composables/useTheme.js';

const { theme, toggle } = useTheme();
</script>

<template>
  <button
    @click="toggle"
    class="p-2 rounded-xl transition-all duration-200 cursor-pointer hover:bg-[var(--bg-tertiary)]"
    style="color: var(--text-tertiary);"
    aria-label="Toggle theme"
  >
    <!-- 月亮图标：亮色模式下显示，点击切换到暗色 -->
    <svg
      v-if="theme === 'light'"
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
    <!-- 太阳图标：暗色模式下显示，点击切换到亮色 -->
    <svg
      v-else
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  </button>
</template>
