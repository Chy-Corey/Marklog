<script setup>
// 友链页面：展示朋友们的信息卡片
// 数据来自 /api/friends，从 content/friends/*.md 读取
import { ref, reactive, onMounted } from 'vue';
import BaseLayout from '../layouts/BaseLayout.vue';
import { fetchApi } from '../composables/useApi.js';

const friends = ref([]);
// 记录头像加载失败的 slug，用于显示首字母占位
const avatarFailed = reactive(new Set());

function onAvatarError(slug, e) {
  avatarFailed.add(slug);
}

onMounted(async () => {
  try {
    friends.value = await fetchApi('/friends');
  } catch (e) {
    console.error('Failed to load friends:', e);
  }
});
</script>

<template>
  <BaseLayout>
    <section class="py-4">
      <h1 class="text-2xl font-extrabold tracking-tight mb-2" style="color: var(--text-primary);">
        Friends
      </h1>
      <p class="text-xs leading-[1.8] mb-8" style="color: var(--text-secondary);">
        Some interesting friends and their websites.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          v-for="friend in friends"
          :key="friend.slug"
          :href="friend.url"
          target="_blank"
          rel="noopener noreferrer"
          class="card p-5 flex items-start gap-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-md no-underline group"
        >
          <!-- 头像 / 占位首字母 -->
          <img
            v-if="!avatarFailed.has(friend.slug)"
            :src="friend.avatar"
            :alt="friend.name"
            class="w-12 h-12 rounded-xl object-cover shrink-0"
            style="border: 2px solid var(--border-color);"
            @error="onAvatarError(friend.slug, $event)"
          />
          <div
            v-else
            class="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0"
            :style="{ background: 'var(--color-accent)' }"
          >
            {{ friend.name[0] }}
          </div>
          <!-- 信息区 -->
          <div class="min-w-0">
            <h3
              class="text-[13px] font-semibold mb-1 transition-colors group-hover:text-[var(--color-accent)]"
              style="color: var(--text-primary);"
            >
              {{ friend.name }}
            </h3>
            <p class="text-[11px] leading-[1.6]" style="color: var(--text-tertiary);">
              {{ friend.description }}
            </p>
          </div>
        </a>
      </div>

      <div v-if="friends.length === 0" class="text-center py-20" style="color: var(--text-tertiary);">
        <p class="text-sm">暂无友链。</p>
      </div>
    </section>
  </BaseLayout>
</template>
