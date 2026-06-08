<script setup>
// 博客详情页：渲染 markdown 正文
// 标题直接从 frontmatter 读取，正文用 # 开头的第一行会被移除（标题已显示在 header 中）
// marked 转换 HTML → DOMPurify 消毒防 XSS → v-html 渲染
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import BaseLayout from '../layouts/BaseLayout.vue';
import { fetchApi } from '../composables/useApi.js';

const route = useRoute();
const router = useRouter();
const post = ref(null);
const error = ref(false);

onMounted(async () => {
  try {
    post.value = await fetchApi(`/blog/${route.params.slug}`);
  } catch (e) {
    error.value = true;
  }
});

const renderedContent = computed(() => {
  if (!post.value?.content) return '';
  // 去掉 # 开头的标题行（已在页面 header 中展示），然后 markdown → HTML → 消毒
  const body = post.value.content.replace(/^# .+\n?/, '').trim();
  return DOMPurify.sanitize(marked(body));
});
</script>

<template>
  <BaseLayout>
    <section class="py-4">
      <!-- 返回按钮：使用 router.back() 回到上一页 -->
      <button
        @click="router.back()"
        class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 mb-6"
        style="color: var(--text-secondary); background: var(--bg-secondary); border-color: var(--border-color);"
        @mouseenter="$event.target.style.borderColor='var(--color-accent)'; $event.target.style.color='var(--color-accent)'"
        @mouseleave="$event.target.style.borderColor='var(--border-color)'; $event.target.style.color='var(--text-secondary)'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back
      </button>

      <div v-if="error" class="text-center py-20" style="color: var(--text-tertiary);">
        <p class="text-sm">文章未找到。</p>
      </div>

      <article v-else-if="post" class="prose-custom">
        <!-- 文章头部：标题 + 日期 + 标签 -->
        <header class="mb-8">
          <h1 class="text-2xl font-extrabold tracking-tight mb-3" style="color: var(--text-primary);">
            {{ post.title }}
          </h1>
          <time class="text-[11px] font-mono" style="color: var(--text-tertiary);">
            {{ post.published_at }}
          </time>
          <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5 mt-3">
            <RouterLink
              v-for="tag in post.tags"
              :key="tag"
              :to="`/blog/tag/${tag}`"
              class="text-[10px] px-2.5 py-0.5 rounded-full transition-all duration-200 hover:scale-105"
              style="color: var(--text-tertiary); background: var(--bg-secondary); border: 1px solid var(--border-color);"
            >
              {{ tag }}
            </RouterLink>
          </div>
        </header>
        <!-- markdown 渲染后的正文 -->
        <div
          class="text-[15px] leading-[1.85]"
          style="color: var(--text-secondary);"
          v-html="renderedContent"
        />
      </article>

      <div v-else class="text-center py-20" style="color: var(--text-tertiary);">
        <p class="text-sm">加载中...</p>
      </div>
    </section>
  </BaseLayout>
</template>

<style scoped>
/* 正文排版样式：标题、段落、图片、代码块、引用等 */
.prose-custom :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 2rem;
  margin-bottom: 1rem;
}
.prose-custom :deep(h2) {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}
.prose-custom :deep(h3) {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}
.prose-custom :deep(img) {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 1.25rem 0;
  border: 1px solid var(--border-color);
}
.prose-custom :deep(p) {
  margin-bottom: 1rem;
}
.prose-custom :deep(ul), .prose-custom :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}
.prose-custom :deep(li) {
  margin-bottom: 0.25rem;
}
.prose-custom :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}
.prose-custom :deep(blockquote) {
  border-left: 3px solid var(--color-accent);
  padding-left: 1rem;
  margin-left: 0;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}
.prose-custom :deep(code) {
  background: var(--bg-secondary);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.85em;
  border: 1px solid var(--border-color);
}
.prose-custom :deep(pre) {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
  border: 1px solid var(--border-color);
}
.prose-custom :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
}
.prose-custom :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: opacity 0.2s;
}
.prose-custom :deep(a:hover) {
  opacity: 0.8;
}
.prose-custom :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 14px;
}
.prose-custom :deep(th),
.prose-custom :deep(td) {
  border: 1px solid var(--border-color);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.prose-custom :deep(th) {
  background: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-primary);
}
.prose-custom :deep(tr:hover) {
  background: var(--bg-secondary);
}
.prose-custom :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 2rem 0;
}
</style>
