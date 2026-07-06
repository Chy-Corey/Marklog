import express from 'express';
import cors from 'cors';
import { join, dirname, extname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import blogRoutes from './routes/blog.js';
import projectsRoutes from './routes/projects.js';
import siteRoutes from './routes/site.js';
import adminRoutes from './routes/admin.js';
import friendsRoutes from './routes/friends.js';
import statsRoutes from './routes/stats.js';
import { syncAllPosts, syncAllProjects, syncAllFriends, watchContentDir } from './content/contentService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { trackPageView } from './middleware/tracking.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// 跨域
app.use(cors());

// 限制 JSON 请求体大小，防止 DoS 攻击
app.use(express.json({ limit: '1mb' }));

// 统计中间件：记录页面访问
app.use(trackPageView);

// 静态文件服务：favicon
app.use('/favicon.ico', express.static(join(__dirname, '..', 'static', 'favicon.ico')));

// 静态文件服务：把 content 目录对外暴露为 /content
// 但拦截 .md 源文件，防止原始 markdown 被直接访问（大小写不敏感）
app.use('/content', (req, res, next) => {
  if (extname(req.path).toLowerCase() === '.md') return res.status(404).end();
  next();
}, express.static(join(__dirname, '..', 'content')));

// 注册各业务路由
app.use('/api/blog', blogRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/stats', statsRoutes);

// 确保 content 子目录存在（图片上传需要）
mkdirSync(join(__dirname, '..', 'content', 'posts', 'images'), { recursive: true });
mkdirSync(join(__dirname, '..', 'content', 'images'), { recursive: true });

// 服务启动时扫描 .md 文件同步到数据库，并启动文件监听
syncAllPosts();
syncAllProjects();
syncAllFriends();
watchContentDir();

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// POST 获取 favicon
app.post('/api/favicon', (req, res) => {
  res.sendFile(join(__dirname, '..', 'static', 'favicon.ico'));
});

// 未匹配的 /api/* 路由返回 JSON 404，而非 Express 默认的 HTML 错误页
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 全局错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

