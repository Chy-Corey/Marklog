# Lemon Party — Personal Blog & Portfolio

个人博客与作品集站点。**前端** Vue 3 + Vite + Tailwind CSS v4，**后端** Express + Markdown 文件驱动，SQLite 持久化。

## 相关文档

| 文档 | 说明 |
|------|------|
| [Docker 部署完全指南](DOCKER.md) | 架构详解、容器配置、数据卷机制、生产环境部署、故障排查 |
| [前端 README](Frontend/README.md) | Vue 3 项目结构、路由、主题系统、组件说明 |
| [后端 README](Backend/README.md) | Express API 路由、数据库设计、内容管理、鉴权机制 |

---

## Docker 部署

### 环境要求

- [Docker](https://docs.docker.com/get-docker/) >= 20.10
- [Docker Compose](https://docs.docker.com/compose/) >= 2.0（Docker Desktop 自带）

### 一键启动

```bash
# 在项目根目录执行
docker compose up --build -d
```

构建完成后：

| 访问地址 | 说明 |
|----------|------|
| `http://localhost` | 前端页面 |
| `http://localhost/api/health` | 后端健康检查 |

### 常用命令

```bash
# 查看实时日志
docker compose logs -f

# 查看后端日志（获取管理令牌等）
docker compose logs -f backend

# 停止所有容器
docker compose down

# 代码修改后重新构建
docker compose up --build -d

# 进入容器调试
docker compose exec backend sh
docker compose exec frontend sh
```

### 管理后台令牌

```bash
# 查看自动生成的令牌
docker compose logs backend | grep "管理员令牌"
```

如需固定令牌，启动时设置环境变量：

```bash
ADMIN_TOKEN=your-secret-token docker compose up --build -d
```

### 数据持久化

`Backend/content/` 目录通过 Docker volume 挂载，容器重建不会丢失数据。直接编辑宿主机上的 `.md` 文件会实时生效，管理后台上传的内容也保存在此目录。

### 生产环境

#### 修改对外端口

编辑 `docker-compose.yml`，修改 frontend 的 ports 映射：

```yaml
frontend:
  ports:
    - "8080:80"    # 改为 8080 端口
```

#### 自定义域名 + HTTPS

在服务器上安装 Nginx 或 Caddy 作为反向代理，指向 Docker 暴露的端口：

```nginx
server {
    listen 80;
    server_name blog.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name blog.example.com;

    ssl_certificate     /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 架构说明

```
浏览器
  │
  ▼
┌─────────────────────────────┐
│  frontend (Nginx :80)       │
│  ├── /          → 静态文件   │
│  ├── /api/*     → 反代 ──────────┐
│  ├── /content/* → 反代 ──────────┤
│  └── /favicon   → 反代 ──────────┤
└─────────────────────────────┘    │
                                   ▼
                          ┌─────────────────┐
                          │ backend (:3000)  │
                          │ Express + Node   │
                          │                  │
                          │ /app/content/ ◄──── volume 挂载
                          └─────────────────┘
```

| 容器 | 基础镜像 | 职责 | 端口 |
|------|----------|------|------|
| `backend` | `node:20-bookworm-slim` | Express API + Markdown 内容服务 | 3000（仅容器内部） |
| `frontend` | `nginx:alpine` | 静态文件服务 + API 反向代理 | 80 → 宿主机 80 |

### 常见问题

**Q: 构建很慢怎么办？**
Docker 会缓存 `npm ci` 层。只要 `package.json` 和 `package-lock.json` 没变，重复构建会跳过依赖安装。首次构建较慢是正常的。

**Q: 修改了内容（.md 文件）需要重新构建吗？**
不需要。`content` 目录是 volume 挂载的，宿主机修改会实时生效。如果通过管理后台修改，同样会直接写入挂载目录。

**Q: 端口 80 被占用怎么办？**
修改 `docker-compose.yml` 中的端口映射，例如改为 `"8080:80"`，然后访问 `http://localhost:8080`。

---

## 本地开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 18

### 安装与运行

```bash
# 后端（终端 1）
cd Backend
npm install
npm run dev       # 启动于 http://localhost:3000

# 前端（终端 2）
cd Frontend
npm install
npm run dev       # 启动于 http://localhost:5173
```

Vite 开发服务器将 `/api` 和 `/content` 请求代理到后端（端口 3000），因此前端可以用相对路径请求数据。

访问 `http://localhost:5173` 查看博客，`http://localhost:5173/admin` 进入管理后台。

---

## 管理后台

访问 `/admin` 路径，输入令牌登录后可使用可视化管理界面：

- 在线编辑文章 frontmatter + 正文
- 上传本地 `.md` 文件直接创建文章
- 上传图片到 `content/posts/images/`
- 增删改操作自动刷新内存缓存，无需重启服务

管理后台接口受 Bearer 令牌保护，每 IP 每分钟限 20 次请求。

---

## 内容管理

所有内容以 Markdown 文件（YAML frontmatter + 正文）存储在 `Backend/content/` 下。有两种方式管理内容：

### 方式一：直接编辑文件

增删改 `Backend/content/` 下的 `.md` 文件，重启后端服务即可生效（Docker 部署无需重启）。

**博客文章** — `content/posts/xxx.md`
```yaml
---
title: 文章标题
description: 文章摘要
published_at: 2026-05-15
tags: [Engineering, Writing]
featured: true
---

正文 Markdown 内容...
```
文件名即 slug（如 `my-article.md` → slug 为 `my-article`）。

**项目** — `content/projects/xxx.md`
```yaml
---
title: 项目名称
description: 项目描述
tags: [AI, Python]
github_url: https://github.com/xxx
demo_url: https://xxx.com
sort_order: 1
---
```

**友链** — `content/friends/xxx.md`
```yaml
---
name: 网站名称
url: https://example.com
avatar: https://example.com/avatar.png
description: 简短介绍
---
```

**主页配置** — `content/home.md`（仅 frontmatter，无正文）

### 方式二：管理后台 UI

通过管理后台在线编辑，支持文章 CRUD、文件上传、图片管理。

---

## 项目结构

```
LemonParty/
├── Backend/                        # Express API 服务
│   ├── package.json
│   ├── Dockerfile
│   ├── content/                    # Markdown 内容（数据源）
│   │   ├── home.md                 # 主页配置（Hero、经历等）
│   │   ├── posts/                  # 博客文章（每篇一个 .md）
│   │   │   └── images/             # 文章图片
│   │   ├── projects/               # 项目展示（每个一个 .md）
│   │   └── friends/                # 友情链接（每个一个 .md）
│   └── src/
│       ├── index.js                # 入口：注册路由、中间件、启动缓存
│       ├── content/
│       │   ├── contentService.js   # 核心：缓存层 + 文件读写 + frontmatter 解析
│       │   └── db.js               # SQLite 数据库初始化
│       ├── routes/
│       │   ├── blog.js             # GET /api/blog, /api/blog/:slug, /api/blog/tags
│       │   ├── projects.js         # GET /api/projects
│       │   ├── site.js             # GET /api/site
│       │   ├── friends.js          # GET /api/friends
│       │   └── admin.js            # 管理后台 CRUD + 文件上传（需令牌 + 限流）
│       └── middleware/
│           └── errorHandler.js     # 全局错误处理
│
├── Frontend/                       # Vue 3 SPA
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf                  # Nginx 配置（SPA 回退 + API 反代）
│   ├── vite.config.js              # Vite 配置 + API 代理
│   ├── index.html
│   └── src/
│       ├── main.js                 # 应用入口
│       ├── App.vue                 # 根组件（主题初始化）
│       ├── router/
│       │   └── index.js            # 路由配置
│       ├── layouts/
│       │   └── BaseLayout.vue      # 基础布局（侧边栏 + 内容 + 页脚 + 灯箱）
│       ├── components/
│       │   ├── sidebar/
│       │   │   ├── Sidebar.vue     # 侧边栏导航
│       │   │   └── ThemeToggle.vue # 亮/暗主题切换
│       │   ├── home/
│       │   │   ├── HeroSection.vue       # 个人介绍、爱好、图片
│       │   │   ├── ExperienceSection.vue # 工作经历
│       │   │   ├── ProjectsSection.vue   # 项目卡片预览
│       │   │   └── BlogSection.vue       # 博客文章预览
│       │   ├── ui/
│       │   │   ├── Card.vue         # 通用卡片
│       │   │   ├── TagPill.vue      # 标签胶囊
│       │   │   ├── PhotoGallery.vue # 照片网格
│       │   │   ├── GalleryImage.vue # 单张图片（懒加载 + 悬停效果）
│       │   │   └── ImageLightbox.vue # 全屏灯箱
│       │   └── Footer.vue           # 页脚
│       ├── pages/
│       │   ├── HomePage.vue        # 主页
│       │   ├── BlogPage.vue        # 博客列表（搜索 + 标签过滤）
│       │   ├── BlogDetailPage.vue  # 博客详情（Markdown 渲染）
│       │   ├── TagPage.vue         # 标签聚合页
│       │   ├── ProjectsPage.vue    # 项目列表
│       │   ├── FriendsPage.vue     # 友链页面
│       │   └── AdminPage.vue       # 管理后台（需令牌登录）
│       ├── composables/
│       │   ├── useApi.js           # API 请求封装
│       │   └── useTheme.js         # 主题切换逻辑
│       └── styles/
│           └── global.css          # Tailwind + CSS 变量 + 动画 + 通用样式
│
├── docker-compose.yml              # Docker 编排配置
└── README.md
```

---

## 功能

- **侧边栏导航** — 固定侧边栏，头像、导航链接、社交图标、主题切换
- **暗色/亮色主题** — CSS 变量驱动，`localStorage` 持久化
- **响应式布局** — 移动端汉堡菜单，侧边栏滑入/滑出
- **主页模块** — Hero 介绍、工作经历、项目卡片、博客预览
- **博客系统** — 列表页（搜索 + 标签过滤）、详情页（Markdown 渲染）
- **标签聚合** — 按标签筛选文章，独立标签页
- **项目展示** — 卡片式布局，GitHub + Demo 链接，标签分类
- **友链页面** — 友情链接卡片网格，头像加载失败时首字母占位
- **图片灯箱** — 点击放大，ESC/背景关闭，滚动锁定
- **管理后台** — 文章 CRUD、.md 文件上传、图片上传、Bearer 令牌认证
- **Markdown 驱动** — 所有内容存为 `.md` 文件（YAML frontmatter + 正文），Git 版本管理友好
- **内存缓存** — 服务启动时一次性解析全部 .md 文件到内存，API 零 I/O
- **安全防护** — DOMPurify XSS 消毒、路径遍历防护、速率限制、.md 源文件禁止外部访问

---

## API 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/blog` | 博客列表（支持 `?tag=` `?featured=true` `?limit=N`） |
| GET | `/api/blog/tags` | 所有标签（按字母排序） |
| GET | `/api/blog/:slug` | 单篇文章（含完整 Markdown 正文） |
| GET | `/api/projects` | 项目列表（按 `sort_order` 升序） |
| GET | `/api/site` | 主页配置（Hero、经历等） |
| GET | `/api/friends` | 友链列表 |
| POST | `/api/admin/post` | 创建文章（需 `Authorization: Bearer <token>`） |
| PUT | `/api/admin/post/:slug` | 更新文章 |
| DELETE | `/api/admin/post/:slug` | 删除文章 |
| POST | `/api/admin/image` | 上传图片（multipart，最大 10MB） |

---

## 配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `PORT` | 后端服务端口 | `3000` |
| `ADMIN_TOKEN` | 管理后台令牌 | 随机生成（启动日志中打印） |

---

## 自定义

### 主题颜色

编辑 `Frontend/src/styles/global.css` 中的 `:root`（亮色）和 `.dark`（暗色）CSS 变量。修改 `--color-accent` 即可更换品牌色。

```css
:root {
  --color-accent: #6366f1;  /* 靛蓝色 */
}
.dark {
  --color-accent: #818cf8;  /* 浅靛蓝 */
}
```

### 个人信息

- **头像/名称/社交链接** — 编辑 `Backend/content/home.md` 的 frontmatter
- **工作经历** — 同上，`experiences` 字段
- **侧边栏社交图标** — 编辑 `Frontend/src/components/sidebar/Sidebar.vue`

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | Vue 3 (Composition API) |
| 构建工具 | Vite 6 |
| CSS | Tailwind CSS v4 |
| 路由 | Vue Router 4 |
| Markdown 渲染 | marked + DOMPurify |
| 后端 | Express 4 |
| 数据库 | SQLite (better-sqlite3) |
| 内容解析 | gray-matter |
| 文件上传 | multer |
| 容器化 | Docker + Docker Compose |

---

## 许可

MIT
