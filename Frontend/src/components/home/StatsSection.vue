<script setup>
// 主页统计区块：展示 7 天和 30 天访问次数
import { ref, onMounted } from 'vue';
import { fetchApi } from '../../composables/useApi.js';

const stats = ref({ week: 0, month: 0 });

onMounted(async () => {
  try {
    stats.value = await fetchApi('/stats');
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
});
</script>

<template>
  <section class="py-10">
    <h2 class="text-lg font-bold tracking-tight mb-6" style="color: var(--text-primary);">
      📊 Traffic
    </h2>

    <div class="grid grid-cols-2 gap-4">
      <div class="card p-5 text-center">
        <div class="text-3xl font-bold" style="color: var(--color-accent);">
          {{ stats.week.toLocaleString() }}
        </div>
        <div class="text-sm mt-1" style="color: var(--text-secondary);">
          近 7 天
        </div>
      </div>
      <div class="card p-5 text-center">
        <div class="text-3xl font-bold" style="color: var(--color-accent);">
          {{ stats.month.toLocaleString() }}
        </div>
        <div class="text-sm mt-1" style="color: var(--text-secondary);">
          近 30 天
        </div>
      </div>
    </div>
  </section>
</template>
