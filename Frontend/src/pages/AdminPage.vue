<script setup>
// 管理员界面：管理 Posts、Projects、Friends
import { ref, onMounted } from 'vue';
import { fetchApi } from '../composables/useApi.js';

const token = ref('');
const authed = ref(false);
const tab = ref('posts'); // 'posts' | 'projects' | 'friends' | 'home'

const editing = ref(null);
const form = ref({});
const loading = ref(false);
const mdFullscreen = ref(false);

// Home 编辑状态
const homeContent = ref('');
const homeLoading = ref(false);
const uploading = ref(false);
const uploadMsg = ref('');

// 图片上传状态
const imgUploading = ref(false);
const imgUrl = ref('');
const imgMsg = ref('');

// SQL 查询状态
const sqlDefaults = {
  posts: 'SELECT slug, title, featured, published_at FROM posts ORDER BY published_at DESC LIMIT 10',
  projects: 'SELECT slug, title, sort_order FROM projects ORDER BY sort_order ASC',
  friends: 'SELECT slug, name, url FROM friends',
};
const sqlInput = ref(sqlDefaults.posts);
const sqlResult = ref(null);
const sqlError = ref('');
const sqlLoading = ref(false);

// 列表数据
const posts = ref([]);
const projects = ref([]);
const friends = ref([]);

function authHeaders() {
  return { Authorization: `Bearer ${token.value}` };
}

async function login() {
  try {
    const res = await fetch('/api/admin/post/__token_check__', { headers: authHeaders() });
    if (res.status === 401) throw new Error('unauthorized');
    localStorage.setItem('admin_token', token.value);
    authed.value = true;
    await loadAll();
  } catch {
    localStorage.removeItem('admin_token');
    authed.value = false;
    alert('令牌无效');
  }
}

onMounted(() => {
  const saved = localStorage.getItem('admin_token');
  if (saved) {
    token.value = saved;
    login();
  }
});

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    authed.value = false;
    alert('令牌已失效，请重新登录');
    throw new Error('unauthorized');
  }
  return res.json();
}

async function adminUpload(url, formData) {
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: formData });
  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    authed.value = false;
    alert('令牌已失效，请重新登录');
    throw new Error('unauthorized');
  }
  return res.json();
}

// ========== 加载数据 ==========

async function loadAll() {
  await Promise.all([loadPosts(), loadProjects(), loadFriends()]);
}

async function loadPosts() {
  try { posts.value = await fetchApi('/blog'); } catch (e) { console.error(e); }
}

async function loadHome() {
  homeLoading.value = true;
  try {
    const res = await adminFetch('/api/admin/home');
    homeContent.value = res.content;
  } catch (e) {
    if (e.message !== 'unauthorized') alert('加载 home.md 失败');
  } finally {
    homeLoading.value = false;
  }
}

async function saveHome() {
  try {
    const res = await adminFetch('/api/admin/home', {
      method: 'PUT',
      body: JSON.stringify({ content: homeContent.value }),
    });
    if (res.error) alert(`保存失败: ${res.error}`);
    else alert('保存成功');
  } catch (e) {
    if (e.message !== 'unauthorized') alert(`保存失败: ${e.message}`);
  }
}

async function loadProjects() {
  try { projects.value = await fetchApi('/projects'); } catch (e) { console.error(e); }
}

async function loadFriends() {
  try { friends.value = await fetchApi('/friends'); } catch (e) { console.error(e); }
}

// ========== Tab 配置 ==========

const tabs = {
  posts: { label: '文章', list: posts, load: loadPosts, api: '/api/admin/post', fields: ['title', 'description', 'published_at', 'tags', 'featured', 'content'] },
  projects: { label: '项目', list: projects, load: loadProjects, api: '/api/admin/project', fields: ['title', 'description', 'tags', 'github_url', 'demo_url', 'sort_order'] },
  friends: { label: '友链', list: friends, load: loadFriends, api: '/api/admin/friend', fields: ['name', 'url', 'avatar', 'description'] },
};

function currentTab() { return tabs[tab.value]; }

// ========== CRUD ==========

function newItem() {
  if (tab.value === 'posts') {
    form.value = { title: '', description: '', published_at: new Date().toISOString().slice(0, 10), tags: [], content: '', featured: false };
  } else if (tab.value === 'projects') {
    form.value = { title: '', description: '', tags: [], github_url: '', demo_url: '', sort_order: 0 };
  } else {
    form.value = { name: '', url: '', avatar: '', description: '' };
  }
  editing.value = null;
}

async function editItem(item) {
  loading.value = true;
  editing.value = item.slug;
  try {
    const full = await adminFetch(`${currentTab().api}/${item.slug}`);
    if (tab.value === 'posts') {
      form.value = {
        title: full.title || '',
        description: full.description || '',
        published_at: full.published_at || '',
        tags: Array.isArray(full.tags) ? full.tags.join(', ') : '',
        featured: full.featured || false,
        content: full.content || '',
      };
    } else if (tab.value === 'projects') {
      form.value = {
        title: full.title || '',
        description: full.description || '',
        tags: Array.isArray(full.tags) ? full.tags.join(', ') : '',
        github_url: full.github_url || '',
        demo_url: full.demo_url || '',
        sort_order: full.sort_order || 0,
      };
    } else {
      form.value = {
        name: full.name || '',
        url: full.url || '',
        avatar: full.avatar || '',
        description: full.description || '',
      };
    }
  } catch (err) {
    if (err.message !== 'unauthorized') alert('加载失败');
    editing.value = null;
  } finally {
    loading.value = false;
  }
}

async function save() {
  // 校验必填字段
  if (tab.value === 'friends') {
    if (!form.value.name?.trim()) { alert('名称不能为空'); return; }
  } else {
    if (!form.value.title?.trim()) { alert('标题不能为空'); return; }
  }

  const payload = { ...form.value };
  // 处理 tags 字段
  if ('tags' in payload) {
    payload.tags = typeof payload.tags === 'string'
      ? payload.tags.split(',').map(t => t.trim()).filter(Boolean)
      : payload.tags;
  }
  // 处理 sort_order
  if ('sort_order' in payload) payload.sort_order = Number(payload.sort_order) || 0;
  // 处理 featured
  if ('featured' in payload) payload.featured = !!payload.featured;

  // 生成 slug
  const nameField = tab.value === 'friends' ? 'name' : 'title';
  if (!editing.value) {
    payload.slug = form.value.slug || payload[nameField].toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  }

  try {
    let result;
    if (editing.value) {
      result = await adminFetch(`${currentTab().api}/${editing.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      result = await adminFetch(currentTab().api, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    if (result.error) { alert(`保存失败: ${result.error}`); return; }
    alert('保存成功');
    editing.value = null;
    form.value = {};
    await currentTab().load();
  } catch (err) {
    if (err.message !== 'unauthorized') alert(`保存失败: ${err.message}`);
  }
}

async function remove(slug) {
  if (!confirm(`确定删除 "${slug}"？`)) return;
  try {
    const result = await adminFetch(`${currentTab().api}/${slug}`, { method: 'DELETE' });
    if (result.error) { alert(`删除失败: ${result.error}`); return; }
    await currentTab().load();
  } catch (err) {
    if (err.message !== 'unauthorized') alert(`删除失败: ${err.message}`);
  }
}

function cancel() {
  editing.value = null;
  form.value = {};
}

// ========== 文件上传 ==========

async function handleMdUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  if (!file.name.toLowerCase().endsWith('.md')) { alert('只允许上传 .md 文件'); return; }

  uploading.value = true;
  uploadMsg.value = '';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const result = await adminUpload('/api/admin/post/upload', formData);
    if (result.error) {
      uploadMsg.value = `错误: ${result.error}`;
    } else {
      uploadMsg.value = `已创建: ${result.slug}`;
      await loadPosts();
    }
  } catch (err) {
    if (err.message !== 'unauthorized') uploadMsg.value = `上传失败: ${err.message}`;
  } finally {
    uploading.value = false;
  }
}

async function handleImageUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) { alert('只允许上传图片'); return; }

  imgUploading.value = true;
  imgMsg.value = '';
  try {
    const formData = new FormData();
    formData.append('image', file);
    const result = await adminUpload('/api/admin/image', formData);
    if (result.error) {
      imgMsg.value = `错误: ${result.error}`;
    } else {
      imgUrl.value = result.url;
      imgMsg.value = '上传成功!';
    }
  } catch (err) {
    if (err.message !== 'unauthorized') imgMsg.value = `上传失败: ${err.message}`;
  } finally {
    imgUploading.value = false;
  }
}

// ========== SQL 查询 ==========

async function runQuery() {
  if (!sqlInput.value.trim()) return;
  sqlLoading.value = true;
  sqlError.value = '';
  sqlResult.value = null;
  try {
    const result = await adminFetch('/api/admin/query', {
      method: 'POST',
      body: JSON.stringify({ sql: sqlInput.value }),
    });
    if (result.error) { sqlError.value = result.error; } else { sqlResult.value = result; }
  } catch (err) {
    if (err.message !== 'unauthorized') sqlError.value = err.message;
  } finally {
    sqlLoading.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 px-4">
    <h1 class="text-xl font-bold mb-6" style="color: var(--text-primary);">管理后台</h1>

    <!-- 登录表单 -->
    <div v-if="!authed" class="card p-6 space-y-3">
      <input
        v-model="token"
        type="password"
        placeholder="管理员令牌"
        class="w-full px-3 py-2 rounded-lg text-sm"
        style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
        @keyup.enter="login"
      />
      <button @click="login" class="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style="background: var(--color-accent); color: #fff;">登录</button>
    </div>

    <template v-else>
      <!-- Tab 切换 -->
      <div class="flex gap-1 mb-6 border-b" style="border-color: var(--border-color);">
        <button
          @click="tab = 'posts'; editing = null; form = {}; sqlInput = sqlDefaults.posts;"
          class="px-4 py-2 text-xs font-medium cursor-pointer transition-colors border-b-2"
          :style="tab === 'posts'
            ? { color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
            : { color: 'var(--text-tertiary)', borderColor: 'transparent' }"
        >
          文章 ({{ posts.length }})
        </button>
        <button
          @click="tab = 'projects'; editing = null; form = {}; sqlInput = sqlDefaults.projects;"
          class="px-4 py-2 text-xs font-medium cursor-pointer transition-colors border-b-2"
          :style="tab === 'projects'
            ? { color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
            : { color: 'var(--text-tertiary)', borderColor: 'transparent' }"
        >
          项目 ({{ projects.length }})
        </button>
        <button
          @click="tab = 'friends'; editing = null; form = {}; sqlInput = sqlDefaults.friends;"
          class="px-4 py-2 text-xs font-medium cursor-pointer transition-colors border-b-2"
          :style="tab === 'friends'
            ? { color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
            : { color: 'var(--text-tertiary)', borderColor: 'transparent' }"
        >
          友链 ({{ friends.length }})
        </button>
        <button
          @click="tab = 'home'; editing = null; form = {}; loadHome();"
          class="px-4 py-2 text-xs font-medium cursor-pointer transition-colors border-b-2"
          :style="tab === 'home'
            ? { color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }
            : { color: 'var(--text-tertiary)', borderColor: 'transparent' }"
        >
          Home
        </button>
      </div>

      <!-- Home 编辑 -->
      <div v-if="tab === 'home'" class="card p-4 space-y-3">
        <div v-if="homeLoading" class="text-center py-8" style="color: var(--text-tertiary);">加载中...</div>
        <template v-else>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium" style="color: var(--text-primary);">home.md</span>
            <button @click="mdFullscreen = !mdFullscreen" class="text-[11px] px-2 py-0.5 rounded cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">
              {{ mdFullscreen ? '退出全屏' : '全屏编辑' }}
            </button>
          </div>
          <div v-if="mdFullscreen" class="fixed inset-0 z-50 flex flex-col p-4" style="background: var(--bg-primary);">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium" style="color: var(--text-primary);">home.md</span>
              <button @click="mdFullscreen = false" class="text-xs px-3 py-1 rounded cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">退出全屏</button>
            </div>
            <textarea
              v-model="homeContent"
              class="flex-1 w-full px-3 py-2 rounded-lg text-sm font-mono"
              style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); resize: none;"
            />
            <div class="flex gap-2 mt-3">
              <button @click="saveHome(); mdFullscreen = false;" class="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style="background: var(--color-accent); color: #fff;">保存</button>
              <button @click="mdFullscreen = false" class="px-4 py-1.5 rounded-lg text-xs cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">取消</button>
            </div>
          </div>
          <textarea
            v-else
            v-model="homeContent"
            rows="20"
            class="w-full px-3 py-2 rounded-lg text-sm font-mono"
            style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); resize: vertical;"
          />
          <div v-if="!mdFullscreen" class="flex gap-2">
            <button @click="saveHome" class="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style="background: var(--color-accent); color: #fff;">保存</button>
          </div>
        </template>
      </div>

      <!-- 工具栏 -->
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span class="text-xs" style="color: var(--text-tertiary);">
          <template v-if="tab === 'posts'">{{ posts.length }} 篇文章</template>
          <template v-else-if="tab === 'projects'">{{ projects.length }} 个项目</template>
          <template v-else>{{ friends.length }} 个友链</template>
        </span>
        <div v-if="!editing" class="flex gap-2">
          <template v-if="tab === 'posts'">
            <label class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style="background: var(--color-accent); color: #fff;">
              {{ uploading ? '上传中...' : '上传 md' }}
              <input type="file" accept=".md" class="hidden" @change="handleMdUpload" :disabled="uploading" />
            </label>
            <label class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" :style="{ background: imgUploading ? 'var(--bg-secondary)' : 'var(--color-accent)', color: imgUploading ? 'var(--text-tertiary)' : '#fff' }">
              {{ imgUploading ? '上传中...' : '上传图片' }}
              <input type="file" accept="image/*" class="hidden" @change="handleImageUpload" :disabled="imgUploading" />
            </label>
          </template>
          <button @click="newItem" class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">
            <template v-if="tab === 'posts'">新建文章</template>
            <template v-else-if="tab === 'projects'">新建项目</template>
            <template v-else>新建友链</template>
          </button>
        </div>
      </div>

      <!-- 上传反馈 -->
      <div v-if="uploadMsg" class="text-xs mb-3" :style="{ color: uploadMsg.startsWith('错误') ? '#e74c3c' : 'var(--color-accent)' }">{{ uploadMsg }}</div>
      <div v-if="imgUrl" class="flex items-center gap-2 mb-3 text-xs">
        <code class="px-2 py-1 rounded select-all" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">{{ imgUrl }}</code>
        <button @click="navigator.clipboard.writeText(imgUrl).then(() => imgMsg = '已复制!')" class="px-2 py-1 rounded text-[10px] cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">复制</button>
        <img :src="imgUrl" class="h-10 rounded" style="border: 1px solid var(--border-color);" />
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="card p-4 mb-6 text-center text-sm" style="color: var(--text-tertiary);">加载中...</div>

      <!-- ===== Posts 表单 ===== -->
      <div v-else-if="tab === 'posts' && editing !== undefined && form.title !== undefined" class="card p-4 mb-6 space-y-3">
        <input v-model="form.title" placeholder="标题" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <input v-model="form.description" placeholder="摘要" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <div class="flex gap-3">
          <input v-model="form.published_at" type="date" class="px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
          <input v-model="form.tags" placeholder="标签（逗号分隔）" class="flex-1 px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
          <label class="flex items-center gap-1 text-xs cursor-pointer" style="color: var(--text-secondary);"><input v-model="form.featured" type="checkbox" /> 精选</label>
        </div>
        <div>
          <div v-if="!mdFullscreen" class="flex items-center justify-between mb-1">
            <span class="text-[11px]" style="color: var(--text-tertiary);">Markdown 正文</span>
            <button @click="mdFullscreen = true" class="text-[11px] px-2 py-0.5 rounded cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">
              全屏编辑
            </button>
          </div>
          <div v-if="mdFullscreen" class="fixed inset-0 z-50 flex flex-col p-4" style="background: var(--bg-primary);">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium" style="color: var(--text-primary);">Markdown 编辑</span>
              <button @click="mdFullscreen = false" class="text-xs px-3 py-1 rounded cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">
                退出全屏
              </button>
            </div>
            <textarea
              v-model="form.content"
              placeholder="Markdown 正文"
              class="flex-1 w-full px-3 py-2 rounded-lg text-sm font-mono"
              style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); resize: none;"
            />
          </div>
          <textarea
            v-else
            v-model="form.content"
            placeholder="Markdown 正文"
            rows="12"
            class="w-full px-3 py-2 rounded-lg text-sm font-mono"
            style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
          />
        </div>
        <div class="flex gap-2">
          <button @click="save" class="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style="background: var(--color-accent); color: #fff;">保存</button>
          <button @click="cancel" class="px-4 py-1.5 rounded-lg text-xs cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">取消</button>
        </div>
      </div>

      <!-- ===== Projects 表单 ===== -->
      <div v-else-if="tab === 'projects' && editing !== undefined && form.title !== undefined" class="card p-4 mb-6 space-y-3">
        <input v-model="form.title" placeholder="项目名称" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <input v-model="form.description" placeholder="项目描述" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <div class="flex gap-3">
          <input v-model="form.tags" placeholder="标签（逗号分隔）" class="flex-1 px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
          <input v-model="form.sort_order" type="number" placeholder="排序" class="w-20 px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        </div>
        <input v-model="form.github_url" placeholder="GitHub URL" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <input v-model="form.demo_url" placeholder="Demo URL" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <div class="flex gap-2">
          <button @click="save" class="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style="background: var(--color-accent); color: #fff;">保存</button>
          <button @click="cancel" class="px-4 py-1.5 rounded-lg text-xs cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">取消</button>
        </div>
      </div>

      <!-- ===== Friends 表单 ===== -->
      <div v-else-if="tab === 'friends' && editing !== undefined && form.name !== undefined" class="card p-4 mb-6 space-y-3">
        <input v-model="form.name" placeholder="名称" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <input v-model="form.url" placeholder="链接 URL" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <input v-model="form.avatar" placeholder="头像 URL" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <input v-model="form.description" placeholder="描述" class="w-full px-3 py-2 rounded-lg text-sm" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" />
        <div class="flex gap-2">
          <button @click="save" class="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style="background: var(--color-accent); color: #fff;">保存</button>
          <button @click="cancel" class="px-4 py-1.5 rounded-lg text-xs cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">取消</button>
        </div>
      </div>

      <!-- ===== 列表 ===== -->
      <div class="space-y-2">
        <!-- Posts 列表 -->
        <template v-if="tab === 'posts'">
          <div v-for="item in posts" :key="item.slug" class="card p-3 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate" style="color: var(--text-primary);">
                {{ item.title }}
                <span v-if="item.featured" class="text-[10px] ml-1 px-1.5 py-0.5 rounded" style="color: var(--color-accent); background: var(--bg-secondary);">精选</span>
              </div>
              <div class="text-[11px]" style="color: var(--text-tertiary);">{{ item.published_at }} &middot; {{ item.slug }}</div>
            </div>
            <div class="flex gap-1">
              <button @click="editItem(item)" class="px-2.5 py-1 rounded text-[11px] cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">编辑</button>
              <button @click="remove(item.slug)" class="px-2.5 py-1 rounded text-[11px] cursor-pointer" style="background: var(--bg-secondary); color: #e74c3c; border: 1px solid var(--border-color);">删除</button>
            </div>
          </div>
        </template>

        <!-- Projects 列表 -->
        <template v-if="tab === 'projects'">
          <div v-for="item in projects" :key="item.slug" class="card p-3 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate" style="color: var(--text-primary);">{{ item.title }}</div>
              <div class="text-[11px] truncate" style="color: var(--text-tertiary);">{{ item.description }}</div>
            </div>
            <div class="flex gap-1">
              <button @click="editItem(item)" class="px-2.5 py-1 rounded text-[11px] cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">编辑</button>
              <button @click="remove(item.slug)" class="px-2.5 py-1 rounded text-[11px] cursor-pointer" style="background: var(--bg-secondary); color: #e74c3c; border: 1px solid var(--border-color);">删除</button>
            </div>
          </div>
        </template>

        <!-- Friends 列表 -->
        <template v-if="tab === 'friends'">
          <div v-for="item in friends" :key="item.slug" class="card p-3 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0 flex items-center gap-2">
              <img v-if="item.avatar" :src="item.avatar" class="w-6 h-6 rounded-full" style="border: 1px solid var(--border-color);" />
              <div class="min-w-0">
                <div class="text-sm font-medium truncate" style="color: var(--text-primary);">{{ item.name }}</div>
                <div class="text-[11px] truncate" style="color: var(--text-tertiary);">{{ item.url }}</div>
              </div>
            </div>
            <div class="flex gap-1">
              <button @click="editItem(item)" class="px-2.5 py-1 rounded text-[11px] cursor-pointer" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);">编辑</button>
              <button @click="remove(item.slug)" class="px-2.5 py-1 rounded text-[11px] cursor-pointer" style="background: var(--bg-secondary); color: #e74c3c; border: 1px solid var(--border-color);">删除</button>
            </div>
          </div>
        </template>
      </div>

      <!-- SQL 查询 -->
      <div class="mt-8 card p-4 space-y-3">
        <h2 class="text-sm font-semibold" style="color: var(--text-primary);">SQL 查询</h2>
        <div class="flex gap-2">
          <textarea
            v-model="sqlInput"
            rows="2"
            placeholder="SELECT * FROM posts LIMIT 10"
            class="flex-1 px-3 py-2 rounded-lg text-xs font-mono"
            style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); resize: vertical;"
            @keydown.ctrl.enter="runQuery"
          />
          <button @click="runQuery" :disabled="sqlLoading" class="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer self-end" style="background: var(--color-accent); color: #fff;">
            {{ sqlLoading ? '执行中...' : '执行' }}
          </button>
        </div>
        <p class="text-[10px]" style="color: var(--text-tertiary);">仅允许 SELECT 查询，Ctrl+Enter 快捷执行</p>

        <div v-if="sqlError" class="text-xs p-3 rounded-lg" style="color: #e74c3c; background: rgba(231,76,60,0.08);">{{ sqlError }}</div>

        <div v-if="sqlResult" class="space-y-2">
          <p class="text-[11px]" style="color: var(--text-tertiary);">返回 {{ sqlResult.count }} 条记录</p>
          <div v-if="sqlResult.rows.length" class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th v-for="key in Object.keys(sqlResult.rows[0])" :key="key" class="text-left px-2 py-1.5 font-semibold border-b" style="color: var(--text-primary); border-color: var(--border-color); background: var(--bg-secondary);">{{ key }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in sqlResult.rows" :key="i">
                  <td v-for="key in Object.keys(row)" :key="key" class="px-2 py-1.5 border-b max-w-[200px] truncate" style="color: var(--text-secondary); border-color: var(--border-color);" :title="String(row[key] ?? '')">{{ row[key] ?? 'NULL' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
