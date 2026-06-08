<script setup>
// 主页博客区块：分两区展示 Featured（精选）+ Recent（最新 5 篇）
// 两个请求并行发出，后端命中内存缓存，响应极快
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchApi } from '../../composables/useApi.js';

const posts = ref([]);
const featured = ref([]);

onMounted(async () => {
  try {
    const [featuredPosts, recentPosts] = await Promise.all([
      fetchApi('/blog?featured=true'),
      fetchApi('/blog?limit=5'),
    ]);
    featured.value = featuredPosts;
    // 二次过滤：确保 Recent 区不出现 Featured 文章
    posts.value = recentPosts.filter(p => !p.featured);
  } catch (e) {
    console.error('Failed to load blog posts:', e);
  }
});
</script>

<template>
  <section id="blog" class="py-10">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
      <div>
        <h2 class="text-lg font-bold tracking-tight mb-2" style="color: var(--text-primary);">
          Blog
        </h2>
        <p class="text-xs leading-[1.8] max-w-xl" style="color: var(--text-secondary);">
          关于 AI 工具、投资、职业成长和工程实践的文章。
        </p>
      </div>
      <RouterLink to="/blog" class="tag-pill hover:text-[var(--color-accent)] w-fit">
        全部文章
      </RouterLink>
    </div>

    <!-- 精选文章：左侧带 accent 色竖线标识 -->
    <div v-if="featured.length" class="space-y-3 mb-6">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider mb-3" style="color: var(--text-tertiary);">
        Featured
      </h3>
      <RouterLink
        v-for="post in featured"
        :key="post.slug"
        :to="`/blog/${post.slug}`"
        class="card block p-5 group border-l-2"
        style="border-left-color: var(--color-accent);"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold mb-1.5 transition-colors" style="color: var(--text-primary);">
              {{ post.title }}
            </h3>
            <p class="text-xs leading-relaxed line-clamp-2" style="color: var(--text-secondary);">
              {{ post.description }}
            </p>
            <div v-if="post.tags?.length" class="flex flex-wrap gap-1 mt-2">
              <RouterLink
                v-for="tag in post.tags"
                :key="tag"
                :to="`/blog/tag/${tag}`"
                @click.stop
                class="text-[10px] px-2 py-0.5 rounded-full transition-all duration-200 hover:scale-105"
                style="color: var(--text-tertiary); background: var(--bg-secondary); border: 1px solid var(--border-color);"
              >
                {{ tag }}
              </RouterLink>
            </div>
          </div>
          <time class="text-[10px] font-mono whitespace-nowrap pt-0.5" style="color: var(--text-tertiary);">
            {{ post.published_at }}
          </time>
        </div>
      </RouterLink>
    </div>

    <!-- 最新文章列表 -->
    <div v-if="posts.length" class="space-y-3">
      <h3 v-if="featured.length" class="text-[11px] font-semibold uppercase tracking-wider mb-3" style="color: var(--text-tertiary);">
        Recent
      </h3>
      <RouterLink
        v-for="post in posts"
        :key="post.slug"
        :to="`/blog/${post.slug}`"
        class="card block p-5 group"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold mb-1.5 transition-colors" style="color: var(--text-primary);">
              {{ post.title }}
            </h3>
            <p class="text-xs leading-relaxed line-clamp-2" style="color: var(--text-secondary);">
              {{ post.description }}
            </p>
            <div v-if="post.tags?.length" class="flex flex-wrap gap-1 mt-2">
              <RouterLink
                v-for="tag in post.tags"
                :key="tag"
                :to="`/blog/tag/${tag}`"
                @click.stop
                class="text-[10px] px-2 py-0.5 rounded-full transition-all duration-200 hover:scale-105"
                style="color: var(--text-tertiary); background: var(--bg-secondary); border: 1px solid var(--border-color);"
              >
                {{ tag }}
              </RouterLink>
            </div>
          </div>
          <time class="text-[10px] font-mono whitespace-nowrap pt-0.5" style="color: var(--text-tertiary);">
            {{ post.published_at }}
          </time>
        </div>
      </RouterLink>
    </div>
  </section>
</template>
