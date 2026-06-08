<script setup>
// 标签过滤页：展示某个标签下的所有文章，支持无限滚动分页
// 每次加载 5 篇，滚动到底部自动加载更多
import { ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import BaseLayout from '../layouts/BaseLayout.vue';
import { fetchApi } from '../composables/useApi.js';

const PAGE_SIZE = 5;

const route = useRoute();
const posts = ref([]);
const tag = ref(route.params.tag);
const offset = ref(0);
const loading = ref(false);
const hasMore = ref(true);

async function loadPosts(reset = false) {
  if (loading.value) return;
  if (!reset && !hasMore.value) return;

  loading.value = true;
  try {
    if (reset) {
      offset.value = 0;
      posts.value = [];
      hasMore.value = true;
    }
    const newPosts = await fetchApi(`/blog?tag=${encodeURIComponent(tag.value)}&limit=${PAGE_SIZE}&offset=${offset.value}`);
    if (reset) {
      posts.value = newPosts;
    } else {
      posts.value = [...posts.value, ...newPosts];
    }
    offset.value += newPosts.length;
    if (newPosts.length < PAGE_SIZE) {
      hasMore.value = false;
    }
  } catch (e) {
    console.error('Failed to load posts:', e);
  } finally {
    loading.value = false;
  }
}

// 监听路由参数变化，标签改变时重新加载
watch(() => route.params.tag, (newTag) => {
  tag.value = newTag;
  loadPosts(true);
}, { immediate: true });
</script>

<template>
  <BaseLayout>
    <section class="py-4">
      <!-- 返回博客列表按钮 -->
      <div class="flex items-center gap-3 mb-6">
        <RouterLink
          to="/blog"
          class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
          style="color: var(--text-secondary); background: var(--bg-secondary); border-color: var(--border-color);"
          @mouseenter="$event.target.style.borderColor='var(--color-accent)'; $event.target.style.color='var(--color-accent)'"
          @mouseleave="$event.target.style.borderColor='var(--border-color)'; $event.target.style.color='var(--text-secondary)'"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Blog
        </RouterLink>
      </div>

      <!-- 当前标签 + 文章数量 -->
      <h1 class="text-2xl font-extrabold tracking-tight mb-2" style="color: var(--text-primary);">
        <span class="tag-pill text-xs px-2 py-0.5 rounded mr-2" style="color: var(--color-accent);">{{ tag }}</span>
        文章
      </h1>
      <p class="text-xs leading-[1.8] mb-8" style="color: var(--text-secondary);">
        标记为 &ldquo;{{ tag }}&rdquo; 的文章。
      </p>

      <!-- 文章列表 -->
      <div class="space-y-3">
        <RouterLink
          v-for="post in posts"
          :key="post.slug"
          :to="`/blog/${post.slug}`"
          class="card block p-5 group"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <h3
                class="text-sm font-semibold mb-1.5 transition-colors"
                style="color: var(--text-primary);"
              >
                {{ post.title }}
              </h3>
              <p class="text-xs leading-relaxed line-clamp-2" style="color: var(--text-secondary);">
                {{ post.description }}
              </p>
              <!-- 标签行：当前标签高亮，其他标签灰色 -->
              <div v-if="post.tags?.length" class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="t in post.tags"
                  :key="t"
                  class="text-[10px] px-2 py-0.5 rounded-full transition-all duration-200"
                  :style="t === tag
                    ? { color: 'var(--color-accent)', background: 'var(--bg-secondary)', border: '1px solid var(--color-accent)' }
                    : { color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }"
                >
                  {{ t }}
                </span>
              </div>
            </div>
            <time class="text-[10px] font-mono whitespace-nowrap pt-0.5" style="color: var(--text-tertiary);">
              {{ post.published_at }}
            </time>
          </div>
        </RouterLink>
      </div>

      <!-- 加载更多按钮 -->
      <div v-if="hasMore && !loading" class="text-center py-6">
        <button
          @click="loadPosts(false)"
          class="tag-pill text-[11px] px-4 py-1.5 cursor-pointer transition-all duration-200 hover:scale-105"
        >
          加载更多
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-8" style="color: var(--text-tertiary);">
        <p class="text-sm">加载中...</p>
      </div>

      <!-- 无文章提示 -->
      <div v-if="!loading && posts.length === 0" class="text-center py-20" style="color: var(--text-tertiary);">
        <p class="text-sm">暂无带有此标签的文章。</p>
      </div>
    </section>
  </BaseLayout>
</template>
