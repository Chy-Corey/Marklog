<script setup>
// 主页英雄区：问候语、个人介绍、亮点、猫图、旅行照片、社交链接
// 支持 **粗体** 语法，经 DOMPurify 消毒后渲染
import { ref, computed, onMounted, nextTick } from 'vue';
import DOMPurify from 'dompurify';
import { fetchApi } from '../../composables/useApi.js';

const site = ref(null);
const showNuomi = ref(false);
const activeCountry = ref(null);
const activeCountryImages = ref([]);

onMounted(async () => {
  try {
    site.value = await fetchApi('/site');
  } catch (e) {
    console.error('Failed to load site config:', e);
  }
});

const hero = computed(() => site.value?.hero || {});

// 将 **text** 转为 <strong> 标签，经 DOMPurify 消毒防 XSS
function bold(text) {
  if (!text) return '';
  const html = text.replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>');
  return DOMPurify.sanitize(html);
}

// 打开灯箱
function openLightbox(src, alt) {
  window.__lightbox?.open(src, alt);
}

// 切换旅行国家图片：先清空再加载，避免旧图片残留
function toggleCountry(country) {
  if (activeCountry.value === country) {
    activeCountry.value = null;
    activeCountryImages.value = [];
    return;
  }
  activeCountry.value = country;
  activeCountryImages.value = [];
  nextTick(() => {
    const c = hero.value.countries?.find(c => c.name === country);
    activeCountryImages.value = c?.images || [];
  });
}
</script>

<template>
  <section v-if="hero.greeting" class="pb-10">
    <!-- 问候语 -->
    <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2" style="color: var(--text-primary);">
      {{ hero.greeting }}
    </h1>
    <p class="text-base font-medium mb-6 gradient-text">
      {{ hero.subtitle }}
    </p>

    <!-- 个人介绍 -->
    <p class="text-[13px] leading-[1.75] mb-3" style="color: var(--text-secondary);" v-html="bold(hero.intro)" />

    <!-- 亮点列表 -->
    <ul class="space-y-2 text-[13px] leading-[1.75] list-none pl-0" style="color: var(--text-secondary);">
      <li v-for="(item, i) in hero.highlights" :key="i" v-html="bold(item)" />
    </ul>

    <!-- 兴趣爱好 -->
    <div v-if="hero.hobbies" class="mt-6">
      <h3 class="text-xs font-semibold uppercase tracking-wider mb-2" style="color: var(--text-tertiary);">
        {{ hero.hobbies.title }}
      </h3>
      <p class="text-[13px] leading-[1.75]" style="color: var(--text-secondary);">
        {{ hero.hobbies.text }}
      </p>
    </div>

    <!-- 生活 / 猫片 -->
    <div v-if="hero.life" class="mt-5">
      <h3 class="text-xs font-semibold uppercase tracking-wider mb-2" style="color: var(--text-tertiary);">
        {{ hero.life.title }}
      </h3>
      <p class="text-[13px] leading-[1.75]" style="color: var(--text-secondary);" v-html="bold(hero.life.text)" />
      <button
        v-if="hero.life.catImages?.length"
        @click="showNuomi = !showNuomi"
        class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer"
        style="color: var(--color-accent); background: var(--bg-secondary); border: 1px solid var(--border-color);"
      >
        <span>🐱</span>
        <span>{{ showNuomi ? `收起 ${hero.life.catName}` : `看看 ${hero.life.catName}` }}</span>
      </button>
      <!-- 猫图网格，使用原生 loading="lazy" 懒加载 -->
      <div v-if="showNuomi && hero.life.catImages?.length" class="mt-3">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div
            v-for="(img, i) in hero.life.catImages"
            :key="i"
            class="relative group overflow-hidden rounded-lg"
            style="border: 1px solid var(--border-color);"
          >
            <img
              :src="img.src"
              :alt="img.alt"
              class="w-full aspect-[4/4] object-cover transition-transform duration-300 group-hover:scale-110 cursor-pointer"
              loading="lazy"
              @click="openLightbox(img.src, img.alt)"
            />
            <div class="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-medium text-white bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {{ img.caption }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 去过的国家 -->
    <div v-if="hero.countries?.length" class="mt-5">
      <h3 class="text-xs font-semibold uppercase tracking-wider mb-2" style="color: var(--text-tertiary);">
        🌏 Travel
      </h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="country in hero.countries"
          :key="country.name"
          @click="toggleCountry(country.name)"
          class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer"
          :style="activeCountry === country.name
            ? { color: 'var(--color-accent)', background: 'var(--bg-secondary)', border: '1px solid var(--color-accent)' }
            : { color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }"
        >
          {{ country.name }}
        </button>
      </div>
      <div v-if="activeCountryImages?.length" class="mt-3">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div
            v-for="(img, i) in activeCountryImages"
            :key="i"
            class="relative group overflow-hidden rounded-lg"
            style="border: 1px solid var(--border-color);"
          >
            <img
              :src="img.src"
              :alt="img.alt"
              class="w-full aspect-[4/4] object-cover transition-transform duration-300 group-hover:scale-110 cursor-pointer"
              loading="lazy"
              @click="openLightbox(img.src, img.alt)"
            />
            <div class="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-medium text-white bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {{ img.caption }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 社交链接行 -->
    <div v-if="hero.socials?.length" class="flex items-center gap-3 mt-6">
      <a
        v-for="s in hero.socials"
        :key="s.platform"
        :href="s.url"
        target="_blank"
        rel="noopener noreferrer"
        class="p-2 rounded-xl transition-all duration-200 hover:scale-110"
        style="color: var(--text-secondary); background: var(--bg-secondary);"
        :title="s.title || s.url"
      >
        <!-- GitHub 图标 -->
        <svg v-if="s.icon === 'github'" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        <!-- X (Twitter) 图标 -->
        <svg v-else-if="s.icon === 'x'" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        <!-- Email 图标 -->
        <svg v-else-if="s.icon === 'email'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
      </a>
    </div>
  </section>
</template>
