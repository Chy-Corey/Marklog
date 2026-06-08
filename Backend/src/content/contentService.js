import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', '..', 'content');

// ========== 数据库预编译语句 ==========

// Posts
const stmtUpsertPost = db.prepare(`
  INSERT INTO posts (slug, title, description, published_at, tags, featured, content, updated_at)
  VALUES (@slug, @title, @description, @published_at, @tags, @featured, @content, datetime('now'))
  ON CONFLICT(slug) DO UPDATE SET
    title=excluded.title, description=excluded.description, published_at=excluded.published_at,
    tags=excluded.tags, featured=excluded.featured, content=excluded.content, updated_at=datetime('now')
`);
const stmtDeletePost = db.prepare('DELETE FROM posts WHERE slug = ?');

// Projects
const stmtUpsertProject = db.prepare(`
  INSERT INTO projects (slug, title, description, tags, github_url, demo_url, sort_order, updated_at)
  VALUES (@slug, @title, @description, @tags, @github_url, @demo_url, @sort_order, datetime('now'))
  ON CONFLICT(slug) DO UPDATE SET
    title=excluded.title, description=excluded.description, tags=excluded.tags,
    github_url=excluded.github_url, demo_url=excluded.demo_url, sort_order=excluded.sort_order, updated_at=datetime('now')
`);
const stmtDeleteProject = db.prepare('DELETE FROM projects WHERE slug = ?');

// Friends
const stmtUpsertFriend = db.prepare(`
  INSERT INTO friends (slug, name, url, avatar, description, updated_at)
  VALUES (@slug, @name, @url, @avatar, @description, datetime('now'))
  ON CONFLICT(slug) DO UPDATE SET
    name=excluded.name, url=excluded.url, avatar=excluded.avatar, description=excluded.description, updated_at=datetime('now')
`);
const stmtDeleteFriend = db.prepare('DELETE FROM friends WHERE slug = ?');

// ========== 启动同步 ==========

// 通用：扫描目录下所有 .md 文件，解析后通过回调写入数据库
function syncDir(dir, syncFn, label) {
  const fullDir = join(CONTENT_DIR, dir);
  if (!existsSync(fullDir)) return 0;

  const files = readdirSync(fullDir).filter(f => f.endsWith('.md'));
  const syncBatch = db.transaction((files) => {
    for (const f of files) {
      try {
        const raw = readFileSync(join(fullDir, f), 'utf-8');
        const { data, content } = matter(raw);
        const slug = f.replace(/\.md$/, '');
        syncFn(slug, normalizeData(data), content);
      } catch (e) {
        console.error(`同步${label}失败: ${f}`, e.message);
      }
    }
  });
  syncBatch(files);
  console.log(`已同步 ${files.length} 个${label}到数据库`);
  return files.length;
}

// 扫描 content/posts/ 并同步
export function syncAllPosts() {
  syncDir('posts', (slug, meta, content) => {
    stmtUpsertPost.run({
      slug,
      title: meta.title || '',
      description: meta.description || '',
      published_at: meta.published_at || '',
      tags: JSON.stringify(meta.tags || []),
      featured: meta.featured ? 1 : 0,
      content: resolveImagePaths(content.trim()),
    });
  }, '文章');
}

// 扫描 content/projects/ 并同步
export function syncAllProjects() {
  syncDir('projects', (slug, meta) => {
    stmtUpsertProject.run({
      slug,
      title: meta.title || '',
      description: meta.description || '',
      tags: JSON.stringify(meta.tags || []),
      github_url: meta.github_url || '',
      demo_url: meta.demo_url || '',
      sort_order: meta.sort_order || 0,
    });
  }, '项目');
}

// 扫描 content/friends/ 并同步
export function syncAllFriends() {
  syncDir('friends', (slug, meta) => {
    stmtUpsertFriend.run({
      slug,
      name: meta.name || '',
      url: meta.url || '',
      avatar: meta.avatar || '',
      description: meta.description || '',
    });
  }, '友链');
}

// ========== 单条同步（文件监听用） ==========

function syncSinglePost(slug) {
  const filePath = join(CONTENT_DIR, 'posts', `${slug}.md`);
  if (!existsSync(filePath)) return;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    const meta = normalizeData(data);
    stmtUpsertPost.run({
      slug,
      title: meta.title || '',
      description: meta.description || '',
      published_at: meta.published_at || '',
      tags: JSON.stringify(meta.tags || []),
      featured: meta.featured ? 1 : 0,
      content: resolveImagePaths(content.trim()),
    });
  } catch (e) {
    console.error(`同步文章失败: ${slug}`, e.message);
  }
}

function syncSingleProject(slug) {
  const filePath = join(CONTENT_DIR, 'projects', `${slug}.md`);
  if (!existsSync(filePath)) return;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);
    const meta = normalizeData(data);
    stmtUpsertProject.run({
      slug,
      title: meta.title || '',
      description: meta.description || '',
      tags: JSON.stringify(meta.tags || []),
      github_url: meta.github_url || '',
      demo_url: meta.demo_url || '',
      sort_order: meta.sort_order || 0,
    });
  } catch (e) {
    console.error(`同步项目失败: ${slug}`, e.message);
  }
}

function syncSingleFriend(slug) {
  const filePath = join(CONTENT_DIR, 'friends', `${slug}.md`);
  if (!existsSync(filePath)) return;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);
    const meta = normalizeData(data);
    stmtUpsertFriend.run({
      slug,
      name: meta.name || '',
      url: meta.url || '',
      avatar: meta.avatar || '',
      description: meta.description || '',
    });
  } catch (e) {
    console.error(`同步友链失败: ${slug}`, e.message);
  }
}

// ========== 文件监听 ==========

let _postsWatchTimer = null;
let _projectsWatchTimer = null;
let _friendsWatchTimer = null;

export function watchContentDir() {
  const watchMap = [
    { dir: 'posts', timer: '_postsWatchTimer', syncFn: syncSinglePost, deleteStmt: stmtDeletePost, label: '文章' },
    { dir: 'projects', timer: '_projectsWatchTimer', syncFn: syncSingleProject, deleteStmt: stmtDeleteProject, label: '项目' },
    { dir: 'friends', timer: '_friendsWatchTimer', syncFn: syncSingleFriend, deleteStmt: stmtDeleteFriend, label: '友链' },
  ];

  for (const { dir, syncFn, deleteStmt, label } of watchMap) {
    try {
      watch(join(CONTENT_DIR, dir), { recursive: false }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.md')) return;
        const slug = filename.replace(/\.md$/, '');
        const filePath = join(CONTENT_DIR, dir, filename);
        if (existsSync(filePath)) {
          console.log(`检测到${label}变化，同步: ${slug}`);
          syncFn(slug);
        } else {
          console.log(`检测到${label}删除，移除: ${slug}`);
          deleteStmt.run(slug);
        }
      });
    } catch (e) {
      console.error(`${label}文件监听启动失败:`, e.message);
    }
  }
}

// ========== 工具函数 ==========

// gray-matter 会把 YYYY-MM-DD 解析为 Date 对象，这里统一转回字符串
function normalizeData(data) {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (result[key] instanceof Date) {
      result[key] = result[key].toISOString().slice(0, 10);
    }
  }
  return result;
}

// 将 markdown 中的相对路径图片引用转为绝对 URL
function resolveImagePaths(content) {
  return content.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, path) => {
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/') || path.startsWith('#')) {
        return match;
      }
      return `![${alt}](/content/posts/${path.replace(/^\.\//, '')})`;
    }
  );
}

// 将元数据对象序列化为 YAML frontmatter 字符串
function stringifyFrontmatter(meta) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      const safeValues = value.map(v => String(v).replace(/,/g, '，'));
      lines.push(`${key}: [${safeValues.join(', ')}]`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push('---\n');
  return lines.join('\n');
}

// ========== 公开读 API ==========

// 获取文章列表，支持按标签、精选、数量和偏移量过滤
export function getPosts({ tag, featured, limit, offset } = {}) {
  let sql = 'SELECT posts.id, posts.slug, posts.title, posts.description, posts.published_at, posts.tags, posts.featured FROM posts';
  const conditions = [];
  const params = {};

  if (featured === 'true') {
    conditions.push('posts.featured = 1');
  } else if (featured === 'false') {
    conditions.push('posts.featured = 0');
  }

  if (tag) {
    conditions.push("json_each.value = @tag");
    sql += ', json_each(posts.tags)';
    params.tag = tag;
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY posts.published_at DESC';

  if (limit != null) {
    sql += ' LIMIT @limit OFFSET @offset';
    params.limit = Number(limit);
    params.offset = Number(offset) || 0;
  }

  const rows = db.prepare(sql).all(params);
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags) }));
}

// 从数据库中提取所有不重复标签，按字母排序
export function getAllTags() {
  const rows = db.prepare(`
    SELECT DISTINCT json_each.value AS tag
    FROM posts, json_each(posts.tags)
    ORDER BY tag ASC
  `).all();
  return rows.map(r => r.tag);
}

// 根据 slug 读取单篇文章的完整内容（含正文）
export function getPostBySlug(slug) {
  if (!/^[\w-]+$/.test(slug)) return null;
  const row = db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug);
  if (!row) return null;
  return { ...row, tags: JSON.parse(row.tags) };
}

// 获取项目列表（从数据库读取）
export function getProjects() {
  const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC').all();
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags) }));
}

// 获取友链列表（从数据库读取）
export function getFriends() {
  return db.prepare('SELECT * FROM friends').all();
}

// 根据 slug 读取单个项目
export function getProjectBySlug(slug) {
  if (!/^[\w-]+$/.test(slug)) return null;
  const row = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);
  if (!row) return null;
  return { ...row, tags: JSON.parse(row.tags) };
}

// 根据 slug 读取单个友链
export function getFriendBySlug(slug) {
  if (!/^[\w-]+$/.test(slug)) return null;
  return db.prepare('SELECT * FROM friends WHERE slug = ?').get(slug) || null;
}

// 读取主页配置（每次请求读文件，因为只有一篇，不缓存也没关系）
export function getHomeConfig() {
  const raw = readFileSync(join(CONTENT_DIR, 'home.md'), 'utf-8');
  const { data } = matter(raw);
  return data;
}

// ========== 管理员写 API ==========

// 创建新文章：写 .md 文件 + 写数据库
export function createPost({ slug, title, description, published_at, tags, featured, content }) {
  if (!slug || !title) return { error: 'slug and title are required' };
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };

  const filePath = join(CONTENT_DIR, 'posts', `${slug}.md`);
  if (existsSync(filePath)) return { error: 'slug 已存在' };

  const frontmatter = stringifyFrontmatter({ title, description, published_at, tags, featured });
  writeFileSync(filePath, frontmatter + (content || ''), 'utf-8');

  stmtUpsertPost.run({
    slug,
    title: title || '',
    description: description || '',
    published_at: published_at || '',
    tags: JSON.stringify(tags || []),
    featured: featured ? 1 : 0,
    content: resolveImagePaths((content || '').trim()),
  });

  return { ok: true, slug };
}

// 更新文章：写 .md 文件 + 写数据库
export function updatePost(slug, updates) {
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };

  const existing = getPostBySlug(slug);
  if (!existing) return { error: 'post not found' };

  const merged = { ...existing, ...updates };
  const { content, body, slug: _, id, created_at, updated_at, ...meta } = merged;

  const frontmatter = stringifyFrontmatter(meta);
  const newContent = updates.content || existing.content || '';
  writeFileSync(join(CONTENT_DIR, 'posts', `${slug}.md`), frontmatter + newContent, 'utf-8');

  stmtUpsertPost.run({
    slug,
    title: meta.title || '',
    description: meta.description || '',
    published_at: meta.published_at || '',
    tags: JSON.stringify(meta.tags || []),
    featured: meta.featured ? 1 : 0,
    content: resolveImagePaths(newContent.trim()),
  });

  return { ok: true, slug };
}

// 删除文章：删 .md 文件 + 删数据库记录
export function deletePost(slug) {
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };
  try {
    unlinkSync(join(CONTENT_DIR, 'posts', `${slug}.md`));
    stmtDeletePost.run(slug);
    return { ok: true };
  } catch {
    return { error: 'post not found' };
  }
}

// 创建项目：写 .md 文件 + 写数据库
export function createProject({ slug, title, description, tags, github_url, demo_url, sort_order }) {
  if (!slug || !title) return { error: 'slug and title are required' };
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };

  const filePath = join(CONTENT_DIR, 'projects', `${slug}.md`);
  if (existsSync(filePath)) return { error: 'slug 已存在' };

  const frontmatter = stringifyFrontmatter({ title, description, tags, github_url, demo_url, sort_order });
  writeFileSync(filePath, frontmatter, 'utf-8');

  stmtUpsertProject.run({
    slug,
    title: title || '',
    description: description || '',
    tags: JSON.stringify(tags || []),
    github_url: github_url || '',
    demo_url: demo_url || '',
    sort_order: sort_order || 0,
  });

  return { ok: true, slug };
}

// 更新项目：写 .md 文件 + 写数据库
export function updateProject(slug, updates) {
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };

  const existing = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);
  if (!existing) return { error: 'project not found' };

  const merged = {
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    tags: updates.tags ?? JSON.parse(existing.tags),
    github_url: updates.github_url ?? existing.github_url,
    demo_url: updates.demo_url ?? existing.demo_url,
    sort_order: updates.sort_order ?? existing.sort_order,
  };

  const frontmatter = stringifyFrontmatter(merged);
  writeFileSync(join(CONTENT_DIR, 'projects', `${slug}.md`), frontmatter, 'utf-8');

  stmtUpsertProject.run({
    slug,
    title: merged.title || '',
    description: merged.description || '',
    tags: JSON.stringify(merged.tags || []),
    github_url: merged.github_url || '',
    demo_url: merged.demo_url || '',
    sort_order: merged.sort_order || 0,
  });

  return { ok: true, slug };
}

// 删除项目：删 .md 文件 + 删数据库记录
export function deleteProject(slug) {
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };
  try {
    unlinkSync(join(CONTENT_DIR, 'projects', `${slug}.md`));
    stmtDeleteProject.run(slug);
    return { ok: true };
  } catch {
    return { error: 'project not found' };
  }
}

// 创建友链：写 .md 文件 + 写数据库
export function createFriend({ slug, name, url, avatar, description }) {
  if (!slug || !name) return { error: 'slug and name are required' };
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };

  const filePath = join(CONTENT_DIR, 'friends', `${slug}.md`);
  if (existsSync(filePath)) return { error: 'slug 已存在' };

  const frontmatter = stringifyFrontmatter({ name, url, avatar, description });
  writeFileSync(filePath, frontmatter, 'utf-8');

  stmtUpsertFriend.run({
    slug,
    name: name || '',
    url: url || '',
    avatar: avatar || '',
    description: description || '',
  });

  return { ok: true, slug };
}

// 更新友链：写 .md 文件 + 写数据库
export function updateFriend(slug, updates) {
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };

  const existing = db.prepare('SELECT * FROM friends WHERE slug = ?').get(slug);
  if (!existing) return { error: 'friend not found' };

  const merged = {
    name: updates.name ?? existing.name,
    url: updates.url ?? existing.url,
    avatar: updates.avatar ?? existing.avatar,
    description: updates.description ?? existing.description,
  };

  const frontmatter = stringifyFrontmatter(merged);
  writeFileSync(join(CONTENT_DIR, 'friends', `${slug}.md`), frontmatter, 'utf-8');

  stmtUpsertFriend.run({
    slug,
    name: merged.name || '',
    url: merged.url || '',
    avatar: merged.avatar || '',
    description: merged.description || '',
  });

  return { ok: true, slug };
}

// 删除友链：删 .md 文件 + 删数据库记录
export function deleteFriend(slug) {
  if (!/^[\w-]+$/.test(slug)) return { error: 'invalid slug' };
  try {
    unlinkSync(join(CONTENT_DIR, 'friends', `${slug}.md`));
    stmtDeleteFriend.run(slug);
    return { ok: true };
  } catch {
    return { error: 'friend not found' };
  }
}
