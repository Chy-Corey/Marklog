import { Router } from 'express';
import multer from 'multer';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import matter from 'gray-matter';
import {
  createPost, updatePost, deletePost, getPostBySlug,
  createProject, updateProject, deleteProject, getProjectBySlug,
  createFriend, updateFriend, deleteFriend, getFriendBySlug,
} from '../content/contentService.js';
import db from '../content/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', '..', 'content');
const ALLOWED_IMAGE_DIRS = ['posts/images', 'images'];

// 根据请求中的 folder 字段解析目标目录，默认 posts/images
function resolveImageDir(folder) {
  const subdir = folder && ALLOWED_IMAGE_DIRS.includes(folder) ? folder : 'posts/images';
  const dir = join(CONTENT_DIR, subdir);
  mkdirSync(dir, { recursive: true });
  return { dir, subdir };
}

// 管理员令牌：优先用环境变量，否则启动时随机生成一个 64 位 hex 串
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(32).toString('hex');
if (!process.env.ADMIN_TOKEN) {
  // 打印令牌到日志，Docker 部署时可通过 docker logs 查看
  console.log('========================================');
  console.log(`[admin] 管理员令牌: ${ADMIN_TOKEN}`);
  console.log('========================================');
}

const router = Router();

// ========== 频率限制 ==========
// 简单的内存滑动窗口限流，每个 IP 每分钟最多 20 次请求
// 防止暴力猜解令牌

const rateMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

// 定期清理过期条目，防止 DDoS 场景下内存无限增长
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}, 120_000);

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_MAX) {
    return res.status(429).json({ error: 'too many requests' });
  }
  next();
}

// ========== 文件上传配置 ==========

// 图片上传：支持 folder 参数选择目标目录（posts/images 或 images），文件名净化防路径遍历
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const { dir } = resolveImageDir(req.body?.folder);
        cb(null, dir);
      } catch (err) { cb(err); }
    },
    filename: (req, file, cb) => {
      const base = file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = extname(file.originalname).toLowerCase();
      // 添加时间戳防重名，避免不同来源的同名文件互相覆盖
      const ts = Date.now().toString(36);
      cb(null, `${base}_${ts}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 最大 10MB
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
    if (!allowed.has(ext)) return cb(new Error(`不允许的图片类型: ${ext}`));
    cb(null, true);
  },
});

// .md 文件上传：用内存存储，解析后直接交给 createPost 写入 content/posts/
const mdUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 最大 5MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.md')) {
      return cb(new Error('只允许上传 .md 文件'));
    }
    cb(null, true);
  },
});

// ========== 鉴权中间件 ==========
// 仅从 Authorization: Bearer <token> 头读取令牌
// 不接受 URL 查询参数，避免令牌泄漏到日志和浏览器历史

function guard(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// 所有管理员路由都经过频率限制
router.use(rateLimit);

// ========== Home 配置 ==========

const HOME_PATH = join(__dirname, '..', '..', 'content', 'home.md');

// GET /api/admin/home — 读取 home.md 原始内容
router.get('/home', guard, (req, res) => {
  const raw = readFileSync(HOME_PATH, 'utf-8');
  res.json({ content: raw });
});

// PUT /api/admin/home — 更新 home.md
router.put('/home', guard, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  writeFileSync(HOME_PATH, content, 'utf-8');
  res.json({ ok: true });
});

// ========== 文章 CRUD ==========

// GET /api/admin/post/:slug — 读取单篇文章完整内容，供编辑表单回填
router.get('/post/:slug', guard, (req, res) => {
  const post = getPostBySlug(req.params.slug);
  if (!post) return res.status(404).json({ error: 'not found' });
  res.json(post);
});

// POST /api/admin/post/upload — 上传 .md 文件直接创建文章
// 后端用 gray-matter 解析 frontmatter，文件名作为 slug
router.post('/post/upload', guard, mdUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' });

  const raw = req.file.buffer.toString('utf-8');
  const { data, content } = matter(raw);
  const slug = req.file.originalname.replace(/\.md$/i, '');

  // slug 安全校验
  if (!/^[\w-]+$/.test(slug)) {
    return res.status(400).json({ error: '文件名只能包含字母、数字、连字符和下划线' });
  }

  const payload = {
    slug,
    title: data.title || slug,
    description: data.description || '',
    published_at: data.published_at || '',
    tags: data.tags || [],
    featured: data.featured || false,
    content: content?.trim() || '',
  };

  const result = createPost(payload);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /api/admin/post — 手动创建文章（JSON 请求体）
router.post('/post', guard, (req, res) => {
  const result = createPost(req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// PUT /api/admin/post/:slug — 更新文章
router.put('/post/:slug', guard, (req, res) => {
  const result = updatePost(req.params.slug, req.body);
  if (result.error) {
    return res.status(result.error === 'post not found' ? 404 : 400).json(result);
  }
  res.json(result);
});

// DELETE /api/admin/post/:slug — 删除文章
router.delete('/post/:slug', guard, (req, res) => {
  const result = deletePost(req.params.slug);
  if (result.error) {
    return res.status(result.error === 'post not found' ? 404 : 400).json(result);
  }
  res.json(result);
});

// ========== 项目 CRUD ==========

// GET /api/admin/project/:slug — 读取单个项目
router.get('/project/:slug', guard, (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'not found' });
  res.json(project);
});

// POST /api/admin/project — 创建项目
router.post('/project', guard, (req, res) => {
  const result = createProject(req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// PUT /api/admin/project/:slug — 更新项目
router.put('/project/:slug', guard, (req, res) => {
  const result = updateProject(req.params.slug, req.body);
  if (result.error) {
    return res.status(result.error === 'project not found' ? 404 : 400).json(result);
  }
  res.json(result);
});

// DELETE /api/admin/project/:slug — 删除项目
router.delete('/project/:slug', guard, (req, res) => {
  const result = deleteProject(req.params.slug);
  if (result.error) {
    return res.status(result.error === 'project not found' ? 404 : 400).json(result);
  }
  res.json(result);
});

// ========== 友链 CRUD ==========

// GET /api/admin/friend/:slug — 读取单个友链
router.get('/friend/:slug', guard, (req, res) => {
  const friend = getFriendBySlug(req.params.slug);
  if (!friend) return res.status(404).json({ error: 'not found' });
  res.json(friend);
});

// POST /api/admin/friend — 创建友链
router.post('/friend', guard, (req, res) => {
  const result = createFriend(req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// PUT /api/admin/friend/:slug — 更新友链
router.put('/friend/:slug', guard, (req, res) => {
  const result = updateFriend(req.params.slug, req.body);
  if (result.error) {
    return res.status(result.error === 'friend not found' ? 404 : 400).json(result);
  }
  res.json(result);
});

// DELETE /api/admin/friend/:slug — 删除友链
router.delete('/friend/:slug', guard, (req, res) => {
  const result = deleteFriend(req.params.slug);
  if (result.error) {
    return res.status(result.error === 'friend not found' ? 404 : 400).json(result);
  }
  res.json(result);
});

// ========== SQL 查询 ==========

// POST /api/admin/query — 执行只读 SQL 查询（仅允许 SELECT）
router.post('/query', guard, (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: '请提供 sql 字段' });
  }

  // 安全校验：只允许 SELECT 语句，禁止写操作和危险语句
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    return res.status(400).json({ error: '仅允许 SELECT 查询' });
  }
  if (/(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|ATTACH|DETACH)/.test(trimmed)) {
    return res.status(400).json({ error: '禁止写操作' });
  }

  try {
    const rows = db.prepare(sql).all();
    res.json({ rows, count: rows.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ========== 图片上传 ==========

// POST /api/admin/image — 上传图片，支持 folder 字段选择目标目录
router.post('/image', guard, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
  const { subdir } = resolveImageDir(req.body?.folder);
  res.json({ ok: true, url: `/content/${subdir}/${req.file.filename}`, filename: req.file.filename });
});

// ========== multer 错误处理 ==========

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '文件过大（最大 10MB）' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

export default router;
