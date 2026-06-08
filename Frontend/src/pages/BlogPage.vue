<script setup>
// 博客列表页：标签点击跳转到 TagPage，Featured 文章左侧有 accent 色竖线
// All Posts 分页加载，每次 5 篇
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import BaseLayout from '../layouts/BaseLayout.vue';
import { fetchApi } from '../composables/useApi.js';

const PAGE_SIZE = 5;

const posts = ref([]);
const featured = ref([]);
const tags = ref([]);
const offset = ref(0);
const loading = ref(false);
const hasMore = ref(true);

onMounted(async () => {
  try {
    const [featuredPosts, allTags] = await Promise.all([
      fetchApi('/blog?featured=true'),
      fetchApi('/blog/tags'),
    ]);
    featured.value = featuredPosts;
    tags.value = allTags;
  } catch (e) {
    console.error('Failed to load featured/tags:', e);
  }
  loadPosts();
});

async function loadPosts() {
  if (loading.value || !hasMore.value) return;

  loading.value = true;
  try {
    const newPosts = await fetchApi(`/blog?featured=false&limit=${PAGE_SIZE}&offset=${offset.value}`);
    posts.value = [...posts.value, ...newPosts];
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
</script>

<template>
  <BaseLayout>
    <section class="py-4">
      <h1 class="text-2xl font-extrabold tracking-tight mb-2" style="color: var(--text-primary);">
        Blog
      </h1>
      <p class="text-xs leading-[1.8] mb-6" style="color: var(--text-secondary);">
        Thinking about AI、Coding and Investing.
      </p>

      <!-- 标签过滤器：点击跳转到 TagPage -->
      <div v-if="tags.length" class="flex flex-wrap gap-2 mb-8">
        <RouterLink
          v-for="tag in tags"
          :key="tag"
          :to="`/blog/tag/${tag}`"
          class="tag-pill text-[10px] px-2.5 py-1 transition-all duration-200"
        >
          {{ tag }}
        </RouterLink>
      </div>

      <!-- 精选区 -->
      <template v-if="featured.length">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider mb-3" style="color: var(--text-tertiary);">
          Featured
        </h2>
        <div class="space-y-3 mb-8">
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

        <h2 class="text-[11px] font-semibold uppercase tracking-wider mb-3" style="color: var(--text-tertiary);">
          All Posts
        </h2>
      </template>

      <!-- 全部文章列表（分页加载） -->
      <div class="space-y-3">
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

      <!-- 加载更多按钮 -->
      <div v-if="hasMore && !loading" class="text-center py-6">
        <button
          @click="loadPosts"
          class="tag-pill text-[11px] px-4 py-1.5 cursor-pointer transition-all duration-200 hover:scale-105"
        >
          加载更多
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-8" style="color: var(--text-tertiary);">
        <p class="text-sm">加载中...</p>
      </div>

      <div v-if="!loading && posts.length === 0 && featured.length === 0" class="text-center py-20" style="color: var(--text-tertiary);">
        <p class="text-sm">暂无文章。</p>
      </div>
    </section>
  </BaseLayout>
</template>
