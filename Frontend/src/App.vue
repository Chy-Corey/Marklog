<script setup>
// 全局主题管理：调用 useTheme() 以激活 watchEffect，
// 确保 document.documentElement 上的 dark 类与当前主题同步
import { onMounted } from 'vue';
import { useTheme } from './composables/useTheme.js';

useTheme();

// 首页访问统计：同一会话只记录一次
onMounted(() => {
  if (!sessionStorage.getItem('visited')) {
    sessionStorage.setItem('visited', '1');
    fetch('/api/stats/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/' })
    });
  }
});
</script>

<template>
  <router-view />
</template>
