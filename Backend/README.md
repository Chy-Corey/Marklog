# Backend

Express API 服务，Marklog 的后端部分。

## 技术栈

| 依赖 | 用途 |
|------|------|
| Express 4 | Web 框架 |
| better-sqlite3 | SQLite 数据库（同步 API，WAL 模式） |
| gray-matter | 解析 Markdown 文件的 YAML frontmatter |
| multer | 文件上传（图片、.md 文件） |
| cors | 跨域支持（开发环境用） |

## 本地开发

```bash
npm install
npm run dev       # 使用 node --watch 启动，文件修改自动重启
```

启动后：
- API 服务：`http://localhost:3000`
- 管理后台令牌打印到终端日志

## 目录结构

```
Backend/
├── content/                    # 内容数据目录（数据源）
│   ├── data.db                 # SQLite 数据库
│   ├── data.db-shm             # SQLite 共享内存
│   ├── data.db-wal             # SQLite 预写日志
│   ├── home.md                 # 主页配置（仅 frontmatter）
│   ├── posts/                  # 博客文章
│   │   ├── *.md                # 每篇文章一个 .md 文件
│   │   └── images/             # 文章图片
│   ├── projects/               # 项目展示
│   │   └── *.md                # 每个项目一个 .md 文件
│   └── friends/                # 友情链接
│       └── *.md                # 每个友链一个 .md 文件
├── static/
│   └── favicon.ico             # 网站图标
└── src/
    ├── index.js                # 入口：注册路由、中间件、启动同步和监听
    ├── content/
    │   ├── db.js               # SQLite 初始化（建表、WAL 模式）
    │   └── contentService.js   # 核心服务：缓存层 + 文件读写 + CRUD
    ├── routes/
    │   ├── blog.js             # 博客 API
    │   ├── projects.js         # 项目 API
    │   ├── site.js             # 主页配置 API
    │   ├── friends.js          # 友链 API
    │   ├── stats.js            # 访问统计 API
    │   └── admin.js            # 管理后台 API（鉴权 + 限流）
    └── middleware/
        ├── errorHandler.js     # 全局错误处理中间件
        └── tracking.js         # 访问统计中间件
```

## API 路由

### 公开接口

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | - |
| GET | `/api/blog` | 博客列表 | `?tag=` `?featured=` `?limit=` `?offset=` |
| GET | `/api/blog/tags` | 所有标签 | - |
| GET | `/api/blog/:slug` | 单篇文章 | - |
| GET | `/api/projects` | 项目列表 | - |
| GET | `/api/site` | 主页配置 | - |
| GET | `/api/friends` | 友链列表 | - |
| GET | `/api/stats` | 访问统计 | `?period=week` 或 `?period=month` |
| POST | `/api/stats/track` | 记录首页访问 | - |

### 管理接口（需 Bearer 令牌）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/post/:slug` | 读取文章（编辑回填） |
| POST | `/api/admin/post` | 创建文章（JSON） |
| POST | `/api/admin/post/upload` | 上传 .md 文件创建文章 |
| PUT | `/api/admin/post/:slug` | 更新文章 |
| DELETE | `/api/admin/post/:slug` | 删除文章 |
| GET | `/api/admin/project/:slug` | 读取项目 |
| POST | `/api/admin/project` | 创建项目 |
| PUT | `/api/admin/project/:slug` | 更新项目 |
| DELETE | `/api/admin/project/:slug` | 删除项目 |
| GET | `/api/admin/friend/:slug` | 读取友链 |
| POST | `/api/admin/friend` | 创建友链 |
| PUT | `/api/admin/friend/:slug` | 更新友链 |
| DELETE | `/api/admin/friend/:slug` | 删除友链 |
| POST | `/api/admin/query` | 执行只读 SQL（仅 SELECT） |
| POST | `/api/admin/image` | 上传图片（multipart） |
| GET | `/api/admin/home` | 读取 home.md |
| PUT | `/api/admin/home` | 更新 home.md |

管理接口需要在请求头中携带令牌：`Authorization: Bearer <token>`

## 数据层设计

### 双写机制

内容同时写入 Markdown 文件和 SQLite 数据库：

```
创建/更新文章
  ├── 写 .md 文件（YAML frontmatter + 正文）→ Git 友好，可版本管理
  └── 写 SQLite（结构化字段）→ API 查询快，支持过滤和分页
```

读取时从 SQLite 查询（内存缓存），不读文件。

### 启动同步

服务启动时扫描 `content/` 下所有 `.md` 文件，解析 frontmatter 后批量写入 SQLite。确保文件和数据库一致。

### 文件监听

启动 `watchContentDir()` 监听 `content/posts/`、`content/projects/`、`content/friends/` 目录。文件变更时自动同步到数据库，无需重启服务。

### SQLite 配置

```javascript
db.pragma('journal_mode = WAL');  // 预写日志模式，读写并发性能更好
```

WAL 模式允许读操作不阻塞写操作，适合「读多写少」的博客场景。

## 数据库表结构

### posts

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| slug | TEXT | 唯一标识（文件名去掉 .md） |
| title | TEXT | 标题 |
| description | TEXT | 摘要 |
| published_at | TEXT | 发布日期（YYYY-MM-DD） |
| tags | TEXT | JSON 数组字符串 |
| featured | INTEGER | 是否精选（0/1） |
| content | TEXT | Markdown 正文 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### projects

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| slug | TEXT | 唯一标识 |
| title | TEXT | 项目名称 |
| description | TEXT | 项目描述 |
| tags | TEXT | JSON 数组字符串 |
| github_url | TEXT | GitHub 链接 |
| demo_url | TEXT | 在线演示链接 |
| sort_order | INTEGER | 排序权重（升序） |

### friends

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| slug | TEXT | 唯一标识 |
| name | TEXT | 网站名称 |
| url | TEXT | 网站链接 |
| avatar | TEXT | 头像 URL |
| description | TEXT | 简短介绍 |

### page_views

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| path | TEXT | 访问路径 |
| visited_at | TEXT | 访问时间 |

## 内容格式

所有内容以 Markdown 文件存储，使用 YAML frontmatter 定义元数据。

### 文章 (`content/posts/xxx.md`)

```yaml
---
title: "文章标题"
description: "文章摘要"
published_at: "2026-05-15"
tags: [Engineering, Writing]
featured: true
---

正文 Markdown 内容...
```

### 项目 (`content/projects/xxx.md`)

```yaml
---
title: "项目名称"
description: "项目描述"
tags: [AI, Python]
github_url: "https://github.com/xxx"
demo_url: "https://xxx.com"
sort_order: 1
---
```

### 友链 (`content/friends/xxx.md`)

```yaml
---
name: "网站名称"
url: "https://example.com"
avatar: "https://example.com/avatar.png"
description: "简短介绍"
---
```

### 主页配置 (`content/home.md`)

仅 frontmatter，无正文。包含 Hero 介绍、工作经历、社交链接等配置。

## 管理后台鉴权

### 令牌生成

```javascript
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(32).toString('hex');
```

- 设置了 `ADMIN_TOKEN` 环境变量 → 使用固定值
- 未设置 → 启动时随机生成 64 位 hex 串，打印到日志

查看自动生成的令牌：

```bash
docker compose logs backend | grep "管理员令牌"
```

### 安全机制

- **Bearer Token**：只从 `Authorization` 请求头读取，不接受 URL 参数
- **频率限制**：每个 IP 每分钟最多 20 次管理接口请求
- **SQL 注入防护**：`/api/admin/query` 只允许 SELECT 语句，禁止写操作
- **路径遍历防护**：文件名经过正则校验（只允许字母、数字、连字符、下划线）
- **文件大小限制**：图片最大 10MB，.md 文件最大 5MB

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口 |
| `NODE_ENV` | `development` | `production` 模式关闭调试日志 |
| `ADMIN_TOKEN` | 随机生成 | 管理后台认证令牌 |

## Docker 构建

```dockerfile
# 多阶段构建
FROM node:20-bookworm-slim AS builder
RUN apt-get install python3 make g++   # better-sqlite3 编译依赖
RUN npm ci                              # 编译原生模块

FROM node:20-bookworm-slim
COPY --from=builder /app/node_modules  # 只复制编译结果，不含编译工具
```

编译工具（python3、make、g++）不进入最终镜像，减小体积。
