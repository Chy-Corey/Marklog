<script setup>
// 侧边栏：桌面端固定左侧，移动端从左侧滑入
// 包含头像、导航链接、社交链接
import { ref, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
const isMobileOpen = ref(false);
const avatarSrc = ref('');

onMounted(() => {
  fetch('/api/favicon', { method: 'POST' })
    .then(res => res.blob())
    .then(blob => {
      avatarSrc.value = URL.createObjectURL(blob);
    })
    .catch(() => {});
});

function closeMobile() {
  isMobileOpen.value = false;
}

// 判断当前路由是否激活，用于导航高亮
function isActive(path) {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
}
</script>

<template>
  <!-- 移动端菜单按钮：仅在小屏显示 -->
  <button
    @click="isMobileOpen = !isMobileOpen"
    class="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-xl shadow-sm border cursor-pointer"
    style="background-color: var(--card-bg); border-color: var(--border-color); color: var(--text-primary);"
    aria-label="Menu"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>

  <!-- 移动端遮罩层：点击关闭侧边栏 -->
  <div
    v-if="isMobileOpen"
    class="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
    @click="closeMobile"
  />

  <!-- 侧边栏主体：桌面端始终可见，移动端通过 translate-x 控制显隐 -->
  <aside
    class="fixed top-0 left-0 h-screen w-64 z-40 flex flex-col transition-transform duration-300"
    :class="isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    style="background-color: var(--sidebar-bg); border-right: 1px solid var(--border-color);"
  >
    <!-- 头像区域 -->
    <div class="px-6 pt-8 pb-6">
      <RouterLink to="/" class="block mb-4" @click="closeMobile">
        <div
          class="w-28 h-28 rounded-2xl flex items-center justify-center overflow-hidden"
          style="background: linear-gradient(135deg, #6366f1, #a855f7); border: 3px solid var(--border-color); box-shadow: 0 4px 16px rgba(0,0,0,0.08);"
        >
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            alt="Avatar"
            class="w-full h-full object-cover"
          />
          <span v-else class="text-4xl font-bold text-white">LP</span>
        </div>
      </RouterLink>
      <h2 class="text-base font-bold mb-0.5" style="color: var(--text-primary);">Lemon Party</h2>
      <p class="text-[11px]" style="color: var(--text-tertiary);">AI Agent Developer</p>
    </div>

    <!-- 导航链接 -->
    <nav class="flex-1 px-3">
      <ul class="space-y-1">
        <li>
          <RouterLink
            to="/"
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
            :style="isActive('/') ? { color: 'var(--color-accent)', background: 'var(--bg-tertiary)' } : { color: 'var(--text-secondary)' }"
            @click="closeMobile"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/projects"
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
            :style="isActive('/projects') ? { color: 'var(--color-accent)', background: 'var(--bg-tertiary)' } : { color: 'var(--text-secondary)' }"
            @click="closeMobile"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Projects
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/blog"
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
            :style="isActive('/blog') ? { color: 'var(--color-accent)', background: 'var(--bg-tertiary)' } : { color: 'var(--text-secondary)' }"
            @click="closeMobile"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            Blog
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/friends"
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
            :style="isActive('/friends') ? { color: 'var(--color-accent)', background: 'var(--bg-tertiary)' } : { color: 'var(--text-secondary)' }"
            @click="closeMobile"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Friends
          </RouterLink>
        </li>
      </ul>
    </nav>

    <!-- 社交链接 -->
    <div class="px-6 pb-6">
      <div class="flex items-center gap-4">
        <a
          href="https://github.com/Chy-Corey"
          target="_blank"
          rel="noopener noreferrer"
          class="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 hover:bg-[var(--bg-tertiary)]"
          style="color: var(--text-tertiary);"
          title="GitHub"
        >
          <svg class="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
        
        <a
          href="mailto:chy.yubao@gmail.com"
          target="_blank"
          rel="noopener noreferrer"
          class="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 hover:bg-[var(--bg-tertiary)]"
          style="color: var(--text-tertiary);"
          title="Email"
        >
          <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </a>
      </div>
      <p class="text-[10px] mt-4" style="color: var(--text-tertiary); opacity: 0.6;">
        &copy; Lemon Party 2026
      </p>
      <p class="text-[10px] mt-1" style="color: var(--text-tertiary); opacity: 0.6;">
        <a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" rel="noopener noreferrer" class="hover:underline">ICP备案/许可证号：鄂ICP备2026026784</a>
      </p>
      <p class="text-[10px] mt-1" style="color: var(--text-tertiary); opacity: 0.6;">
        <a href="https://beian.mps.gov.cn/#/query/webSearch" target="_blank" rel="noopener noreferrer" class="hover:underline">鄂公网安备42011102006298号</a>
      </p>
    </div>
  </aside>
</template>
