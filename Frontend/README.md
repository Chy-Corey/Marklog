# Frontend

Vue 3 单页应用，Marklog 的前端部分。

## 技术栈

| 依赖 | 用途 |
|------|------|
| Vue 3 | Composition API 前端框架 |
| Vue Router 4 | 客户端路由（history 模式） |
| Vite 6 | 构建工具 + 开发服务器 |
| Tailwind CSS v4 | 原子化 CSS 框架 |
| marked | Markdown 解析 |
| DOMPurify | XSS 消毒（渲染 Markdown 时防止注入） |

## 本地开发

```bash
npm install
npm run dev       # 启动于 http://localhost:5173
```

Vite 开发服务器自动将 `/api` 和 `/content` 请求代理到 `http://localhost:3000`（后端），配置见 `vite.config.js`。

## 构建

```bash
npm run build     # 输出到 dist/
npm run preview   # 本地预览构建产物
```

## 目录结构

```
src/
├── main.js                     # 应用入口，挂载 Vue 实例
├── App.vue                     # 根组件，初始化主题
├── router/
│   └── index.js                # 路由配置（7 条路由）
├── layouts/
│   └── BaseLayout.vue          # 基础布局：侧边栏 + 内容区 + 页脚 + 灯箱
├── components/
│   ├── sidebar/
│   │   ├── Sidebar.vue         # 侧边栏：头像、导航、社交图标、主题切换
│   │   └── ThemeToggle.vue     # 亮/暗主题切换按钮
│   ├── home/
│   │   ├── HeroSection.vue     # 主页：个人介绍、爱好、头像、旅行照片
│   │   ├── ExperienceSection.vue  # 主页：工作经历时间线
│   │   ├── ProjectsSection.vue    # 主页：项目卡片预览
│   │   ├── BlogSection.vue        # 主页：博客文章预览
│   │   └── StatsSection.vue       # 主页：访问统计（周/月）
│   ├── ui/
│   │   ├── Card.vue            # 通用卡片组件
│   │   ├── TagPill.vue         # 标签胶囊
│   │   ├── PhotoGallery.vue    # 照片网格
│   │   ├── GalleryImage.vue    # 单张图片（懒加载 + 悬停效果）
│   │   └── ImageLightbox.vue   # 全屏灯箱（点击放大，ESC 关闭）
│   └── Footer.vue              # 页脚（备案信息）
├── pages/
│   ├── HomePage.vue            # 主页：组合 Hero、经历、项目、博客模块
│   ├── BlogPage.vue            # 博客列表：搜索 + 标签过滤
│   ├── BlogDetailPage.vue      # 博客详情：Markdown 渲染 + 标签
│   ├── TagPage.vue             # 标签聚合：按标签筛选文章
│   ├── ProjectsPage.vue        # 项目列表：卡片式布局
│   ├── FriendsPage.vue         # 友链页面：头像卡片网格
│   └── AdminPage.vue           # 管理后台：文章/项目/友链 CRUD、Home 配置编辑、文件上传
├── composables/
│   ├── useApi.js               # API 请求封装（fetch wrapper）
│   └── useTheme.js             # 主题切换逻辑（localStorage 持久化）
└── styles/
    └── global.css              # Tailwind 导入 + CSS 变量 + 动画 + 通用样式
```

## 路由

| 路径 | 页面 | 加载方式 |
|------|------|----------|
| `/` | 主页 | 同步加载 |
| `/blog` | 博客列表 | 同步加载 |
| `/blog/tag/:tag` | 标签聚合 | 同步加载 |
| `/blog/:slug` | 博客详情 | 同步加载 |
| `/projects` | 项目列表 | 同步加载 |
| `/friends` | 友链页面 | 懒加载 |
| `/admin` | 管理后台 | 懒加载 |

`friends` 和 `admin` 使用 `() => import(...)` 动态导入，减少首屏加载体积。

## 主题系统

- 使用 CSS 变量定义颜色（见 `global.css` 中的 `:root` 和 `.dark`）
- `useTheme()` composable 管理状态，通过 `localStorage` 持久化
- 切换时在 `<html>` 上添加/移除 `dark` class
- 所有组件通过 `var(--color-xxx)` 引用颜色，自动跟随主题切换

## API 交互

所有 API 请求通过 `useApi.js` 的 `fetchApi()` 函数：

```javascript
import { fetchApi } from '../composables/useApi';

const posts = await fetchApi('/blog');           // GET /api/blog
const post = await fetchApi('/blog/my-article'); // GET /api/blog/my-article
```

开发环境由 Vite proxy 转发到后端；生产环境由 Nginx 反向代理。

## Docker 构建

```dockerfile
# 多阶段构建
FROM node:20-alpine AS builder    # 阶段 1：构建 Vue 应用
RUN npm ci && npm run build

FROM nginx:alpine                 # 阶段 2：Nginx 服务静态文件
COPY --from=builder /app/dist /usr/share/nginx/html
```

最终镜像只有 Nginx + 构建产物（约 20MB），不含 node_modules。Nginx 配置见 `nginx.conf`。
