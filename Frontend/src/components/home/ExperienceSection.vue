<script setup>
// 工作经历区块：按公司分组，每家公司下可包含多个角色
// 数据来自 /api/site 的 experiences 字段
import { ref, computed, onMounted } from 'vue';
import { fetchApi } from '../../composables/useApi.js';

const site = ref(null);

onMounted(async () => {
  try {
    site.value = await fetchApi('/site');
  } catch (e) {
    console.error('Failed to load site config:', e);
  }
});

const experiences = computed(() => site.value?.experiences || []);
</script>

<template>
  <section v-if="experiences.length" class="py-10">
    <h2 class="text-lg font-bold tracking-tight mb-8" style="color: var(--text-primary);">
      Experience
    </h2>

    <div class="space-y-12">
      <div v-for="(exp, i) in experiences" :key="i">
        <!-- 公司头部：Logo + 名称 + 时间段 -->
        <div class="flex items-center justify-between mb-5">
          <a :href="exp.url" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 group">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
              style="background: var(--color-accent);"
            >
              <img v-if="exp.logo" :src="exp.logo" :alt="exp.company" class="w-full h-full object-cover" />
              <span v-else class="text-xs font-bold text-white">{{ exp.company[0] }}</span>
            </div>
            <span
              class="text-sm font-semibold transition-colors"
              style="color: var(--text-primary);"
            >
              {{ exp.company }}
            </span>
          </a>
          <!-- 桌面端显示时间段 -->
          <span class="text-[11px] font-mono hidden sm:block" style="color: var(--text-tertiary);">
            {{ exp.period }}
          </span>
        </div>

        <!-- 移动端时间段 -->
        <div class="sm:hidden mb-3">
          <span class="text-[11px] font-mono" style="color: var(--text-tertiary);">
            {{ exp.period }}
          </span>
        </div>

        <!-- 角色卡片列表 -->
        <div class="space-y-3">
          <div v-for="(role, j) in exp.roles" :key="j" class="card p-5">
            <h3 class="text-[13px] font-semibold mb-2" style="color: var(--text-primary);">
              {{ role.title }}
            </h3>
            <p class="text-xs leading-[1.8]" style="color: var(--text-secondary);">
              {{ role.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
