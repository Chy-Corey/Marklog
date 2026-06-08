# Docker 部署完全指南

本文档是 LemonParty Docker 部署的详细技术参考。如需快速上手请查看 [README.md](README.md)。

---

## 目录

- [架构总览](#架构总览)
- [容器详解](#容器详解)
- [网络模型](#网络模型)
- [数据卷与持久化](#数据卷与持久化)
- [构建流程](#构建流程)
- [部署操作手册](#部署操作手册)
- [管理后台令牌](#管理后台令牌)
- [生产环境配置](#生产环境配置)
- [故障排查](#故障排查)

---

## 架构总览

```
                        宿主机:80
                           │
                           ▼
              ┌────────────────────────┐
              │    frontend 容器       │
              │    Nginx (alpine)      │
              │                        │
              │  /              → 静态文件 (Vue SPA)
              │  /api/*         → 反向代理 ──────┐
              │  /content/*     → 反向代理 ──────┤
              │  /favicon.ico   → 反向代理 ──────┤
              └────────────────────────┘        │
                                                ▼
                                    ┌────────────────────┐
                                    │   backend 容器      │
                                    │   Node.js (Debian)  │
                                    │                     │
                                    │   Express :3000     │
                                    │   SQLite (内存缓存) │
                                    │                     │
                                    │   /app/content/ ◄───── named volume
                                    └────────────────────┘
```

### 请求流转

1. 浏览器访问 `http://localhost:80`
2. Nginx 接收请求，匹配 location 规则：
   - `/`、`/blog`、`/projects` 等前端路由 → 返回 `index.html`（Vue SPA 接管路由）
   - `/api/*`、`/content/*`、`/favicon.ico` → 反向代理到 `backend:3000`
3. backend 容器通过 Docker 内部 DNS 解析 `backend` 主机名，处理 API 请求
4. 后端从内存缓存读取数据（启动时从 SQLite + Markdown 文件加载），返回 JSON

### 为什么后端不直接暴露端口？

所有流量统一经过 Nginx 入口，好处是：
- 单一入口，简化防火墙和 SSL 配置
- Nginx 处理静态文件性能更好
- 后端端口仅容器内部可达，减少攻击面

---

## 容器详解

### frontend 容器

**基础镜像**：`nginx:alpine`

**Dockerfile 解析**（多阶段构建）：

```dockerfile
# 阶段 1：构建 Vue 应用
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./      # 先复制依赖描述，利用 Docker 缓存层
RUN npm ci                 # 安装依赖（只要 package.json 不变就命中缓存）
COPY . .                   # 复制源代码
RUN npm run build          # 构建，输出到 /app/dist

# 阶段 2：Nginx 服务静态文件
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html   # 只复制构建产物
COPY nginx.conf /etc/nginx/conf.d/default.conf         # 覆盖默认 Nginx 配置
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**为什么用多阶段构建？**
- 阶段 1 的 `node_modules`（约 200MB+）不会进入最终镜像
- 最终镜像只有 Nginx + 构建产物（约 20MB），体积极小

**Nginx 配置详解**（`Frontend/nginx.conf`）：

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Vue Router history 模式
    # 用户访问 /blog/my-post 时，文件不存在，返回 index.html
    # Vue Router 在前端接管路由解析
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 内容文件代理（图片、Markdown 渲染后的 HTML 等）
    location /content/ {
        proxy_pass http://backend:3000;
    }

    # Favicon 代理
    location = /favicon.ico {
        proxy_pass http://backend:3000;
    }

    # 静态资源长期缓存（Vite 构建的 JS/CSS 带 hash 文件名）
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

`proxy_pass http://backend:3000` 中的 `backend` 是 Docker 内部网络的服务名，由 Docker DNS 自动解析为 backend 容器的 IP。

---

### backend 容器

**基础镜像**：`node:20-bookworm-slim`（Debian）

**Dockerfile 解析**（多阶段构建）：

```dockerfile
# 阶段 1：编译原生模块
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# better-sqlite3 是 C++ 原生模块，需要 Python + make + g++ 编译
COPY package*.json ./
RUN npm ci                  # 安装全部依赖并编译原生模块

# 阶段 2：只复制编译结果
FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules   # 复制编译好的 node_modules
COPY . .                                                # 复制源代码
EXPOSE 3000
CMD ["node", "src/index.js"]
```

**为什么用多阶段构建？**
- `python3`、`make`、`g++` 等编译工具（约 300MB+）不会进入最终镜像
- 最终镜像只包含 Node.js 运行时 + 编译好的 node_modules + 源代码

**启动流程**：

1. `node src/index.js` 启动 Express 服务
2. 扫描 `/app/content/` 下所有 `.md` 文件，解析 YAML frontmatter，写入 SQLite + 内存缓存
3. 启动文件监听（`watchContentDir`），内容变更时自动刷新缓存
4. 注册路由，开始监听 3000 端口

**环境变量**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `development` | `production` 模式下 Express 不打印额外调试信息 |
| `PORT` | `3000` | 后端监听端口（容器内部） |
| `ADMIN_TOKEN` | 随机生成 | 管理后台认证令牌 |

---

## 网络模型

```yaml
networks:
  lemonparty-network:
    driver: bridge
```

### 什么是 bridge 网络？

Docker bridge 网络是一个虚拟的二层交换机，所有加入同一 bridge 网络的容器可以互相通过服务名通信。

```
lemonparty-network (bridge)
    │
    ├── frontend (172.18.0.2)
    │     └── 可通过 "backend" 主机名访问后端
    │
    └── backend (172.18.0.3)
          └── 可通过 "frontend" 主机名访问前端（虽然没有这个需求）
```

### 服务发现机制

Docker 内置 DNS 服务器自动将服务名解析为容器 IP：

```
frontend 容器内：
  ping backend  →  解析为 172.18.0.3  →  backend 容器

这就是 nginx.conf 中 proxy_pass http://backend:3000 能工作的原因
```

### 端口映射

```yaml
frontend:
  ports:
    - "80:80"       # 宿主机:80 → 容器:80
```

只有 frontend 映射了端口。backend 的 3000 端口仅在容器网络内部可达，外部无法直接访问。

---

## 数据卷与持久化

### Named Volume

```yaml
backend:
  volumes:
    - content-data:/app/content    # named volume 挂载

volumes:
  content-data:
```

`content-data` 是一个 Docker Named Volume，数据存储在 Docker 管理的目录中：

```
Windows (WSL2)：/var/lib/docker/volumes/lemonparty_content-data/_data
Linux：          /var/lib/docker/volumes/lemonparty_content-data/_data
macOS：          /var/lib/docker/volumes/lemonparty_content-data/_data
```

这个路径在 WSL2 虚拟机内部，Windows 文件管理器无法直接访问。

### 首次挂载行为

Named Volume 有一个重要特性：**首次挂载到空卷时，Docker 会自动把容器内的目录内容复制到卷中**。

```
第一次 docker compose up：
  ① 镜像构建时 COPY . . 把 Backend/content/ 复制进了镜像
  ② 容器启动，挂载空卷 content-data 到 /app/content
  ③ Docker 检测到空卷 → 自动把容器内 /app/content/* 复制到卷里
  ④ 卷里就有了你开发时的所有内容（.md 文件、图片等）

之后：
  卷和容器完全独立，互不影响
```

### 卷的生命周期

| 操作 | 容器 | 卷（数据） |
|------|------|-----------|
| `docker compose down` | 删除 | ✅ 保留 |
| `docker compose up -d` | 重建 | ✅ 读取已有数据 |
| `docker compose down -v` | 删除 | ❌ **删除** |
| `docker compose up -d`（删卷后） | 新建 | 🔄 从镜像重新复制 |

### 卷里有什么？

```
/app/content/
├── data.db              ← SQLite 数据库（文章索引、项目索引等）
├── data.db-shm          ← SQLite 共享内存文件
├── data.db-wal          ← SQLite 预写日志
├── home.md              ← 主页配置
├── posts/               ← 博客文章
│   ├── my-article.md
│   └── images/          ← 上传的图片
│       └── photo.jpg
├── projects/            ← 项目展示
│   └── my-project.md
└── friends/             ← 友情链接
    └── friend-site.md
```

### 宿主机与卷的同步问题

使用 Named Volume 时，宿主机上的 `Backend/content/` 和卷里的数据是**两份独立副本**：

```
宿主机 Backend/content/my-article.md   ← 开发时的文件
         ↕ 不同步
卷 content-data/my-article.md          ← 容器运行时的数据
```

- 在宿主机修改 `.md` 文件 → 卷里**不会**更新 → 容器读不到新内容
- 通过管理后台编辑 → 写入卷 → 宿主机**看不到**变更
- 需要同步时：`docker compose down` → 修改文件 → `docker compose up -d --build`（重新构建镜像，下次 `down -v` 后重新挂载会从新镜像复制）

如果需要宿主机修改实时生效，可以改为 Bind Mount（见[生产环境配置](#bind-mount-模式)）。

---

## 构建流程

### 完整构建过程

```bash
docker compose up --build -d
```

```
① 构建 backend 镜像
   ├── 拉取 node:20-bookworm-slim 基础镜像
   ├── 安装 python3, make, g++
   ├── npm ci（编译 better-sqlite3 原生模块）
   ├── 拉取 node:20-bookworm-slim（生产阶段）
   ├── 复制编译好的 node_modules
   └── 复制源代码

② 构建 frontend 镜像
   ├── 拉取 node:20-alpine 基础镜像
   ├── npm ci
   ├── npm run build（Vite 构建 Vue 应用）
   ├── 拉取 nginx:alpine
   ├── 复制构建产物 dist/
   └── 复制 nginx.conf

③ 创建 lemonparty-network 网络

④ 启动 backend 容器
   ├── 挂载 content-data 卷到 /app/content
   └── 等待健康检查通过

⑤ 启动 frontend 容器
   └── depends_on: backend 确保后端先启动
```

### Docker 缓存机制

Docker 按层缓存，只要某一层的输入不变就跳过：

```dockerfile
COPY package*.json ./    # ← 只要 package.json 不变，这层和之后的 npm ci 都命中缓存
RUN npm ci
COPY . .                 # ← 源代码变了，从这层开始重新执行
```

所以：
- 只改了 `.md` 文件 → 重新 `COPY . .` → 很快
- 改了 `package.json` → 重新 `npm ci` → 较慢（需要下载依赖）
- 改了 Dockerfile → 全部重新构建 → 最慢

### 首次构建 vs 后续构建

| 场景 | 耗时（估算） |
|------|-------------|
| 首次构建（无缓存） | 3-8 分钟 |
| 只改了源代码 | 10-30 秒 |
| 改了 package.json | 1-3 分钟 |
| 改了 Dockerfile | 3-8 分钟 |

---

## 部署操作手册

### 首次部署

```powershell
# 1. 确保 Docker Desktop 正在运行

# 2. 在项目根目录构建并启动
docker compose up --build -d

# 3. 查看构建日志（确认无报错）
docker compose logs -f

# 4. 等待 backend 健康检查通过
docker compose ps
# 状态应显示 "Up (healthy)"

# 5. 访问 http://localhost
```

### 获取管理后台令牌

```bash
# Linux / macOS / Git Bash
docker compose logs backend | grep "管理员令牌"

# PowerShell
docker compose logs backend | Select-String "管理员令牌"

# 输出示例：
# [admin] 管理员令牌: e94f702b...fa0b8e76
```

### 日常管理

```powershell
# 查看运行状态
docker compose ps

# 查看所有服务日志（实时跟踪）
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 只看前端日志
docker compose logs -f frontend

# 重启所有服务
docker compose restart

# 重启单个服务
docker compose restart backend

# 停止所有容器（保留数据卷）
docker compose down

# 停止并删除数据卷（⚠️ 数据丢失）
docker compose down -v
```

### 更新部署

```powershell
# 拉取代码
git pull

# 重新构建并部署
docker compose up --build -d

# 清理旧镜像释放磁盘空间
docker image prune -f
```

### 进入容器调试

```powershell
# 进入后端容器
docker compose exec backend sh

# 进入后容器后可以：
ls /app/content/                    # 查看内容目录
cat /app/content/posts/xxx.md       # 查看文章文件
sqlite3 /app/content/data.db ".tables"  # 查看数据库表
node -e "console.log(process.env)"     # 查看环境变量

# 退出容器
exit
```

---

## 管理后台令牌

### 令牌机制

后端启动时，如果没有设置 `ADMIN_TOKEN` 环境变量，会自动生成一个 64 位随机 hex 串并打印到日志。

```javascript
// Backend/src/routes/admin.js
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(32).toString('hex');
```

### 认证方式

所有管理接口需要在请求头中携带令牌：

```
Authorization: Bearer <your-token>
```

### 安全机制

- **频率限制**：每个 IP 每分钟最多 20 次请求，防止暴力破解
- **不接受 URL 参数**：令牌只从请求头读取，避免泄漏到日志和浏览器历史
- **HTTPS 重要性**：生产环境必须启用 HTTPS，否则令牌在传输中明文暴露

### 设置固定令牌

```powershell
# 方式一：写入 docker-compose.yml
# 在 backend 的 environment 中添加：
#   - ADMIN_TOKEN=your-secure-token-here

# 方式二：命令行临时指定
$env:ADMIN_TOKEN = "your-secure-token"
docker compose up -d
```

---

## 生产环境配置

### 设置固定管理令牌

编辑 `docker-compose.yml`，在 backend 的 environment 中添加：

```yaml
backend:
  environment:
    - NODE_ENV=production
    - PORT=3000
    - ADMIN_TOKEN=your-secure-token-here
```

### 修改对外端口

```yaml
frontend:
  ports:
    - "8080:80"    # 宿主机 8080 → 容器 80
```

### Bind Mount 模式

如果需要在宿主机直接编辑 `.md` 文件并实时生效，将 Named Volume 改为 Bind Mount：

```yaml
backend:
  volumes:
    - ./Backend/content:/app/content    # 宿主机目录直接映射到容器
```

**区别**：

| | Named Volume | Bind Mount |
|---|---|---|
| 数据位置 | Docker 管理的内部目录 | 宿主机项目目录 |
| 宿主机可见 | ❌ 需要 docker 命令访问 | ✅ 直接在文件管理器看到 |
| 宿主机编辑 | ❌ 不会同步到容器 | ✅ 实时生效 |
| 首次挂载 | 从镜像复制内容 | 直接使用宿主机目录 |
| 适用场景 | 生产环境（数据由容器管理） | 开发环境（需要频繁编辑） |

### HTTPS 配置

在服务器上使用 Nginx 或 Caddy 反向代理：

```nginx
# /etc/nginx/sites-available/lemonparty
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
        proxy_pass http://127.0.0.1:80;    # 指向 Docker 暴露的端口
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

使用 Caddy 更简单（自动 HTTPS）：

```
blog.example.com {
    reverse_proxy localhost:80
}
```

### 健康检查

backend 容器配置了健康检查：

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
  interval: 30s      # 每 30 秒检查一次
  timeout: 10s       # 超时时间
  retries: 3         # 连续 3 次失败标记为 unhealthy
  start_period: 10s  # 启动后 10 秒内不检查（给应用启动时间）
```

查看健康状态：

```powershell
docker compose ps
# STATUS 列会显示 Up (healthy) 或 Up (unhealthy)
```

### 自动重启

```yaml
restart: unless-stopped
```

- 容器异常退出 → 自动重启
- `docker compose down` → 正常停止，不重启
- Docker 宿主机重启 → 自动启动

---

## 故障排查

### 构建失败

```powershell
# 查看完整构建日志
docker compose build --no-cache 2>&1

# 常见原因：
# 1. npm ci 失败 → 检查 package.json / package-lock.json 是否一致
# 2. 原生模块编译失败 → 检查 Dockerfile 中是否安装了编译工具
# 3. 网络问题 → 检查网络连接，或配置 npm 镜像源
```

### 容器启动后立即退出

```powershell
# 查看退出原因
docker compose ps -a        # 查看退出码
docker compose logs backend  # 查看日志

# 常见原因：
# - 端口被占用
# - 数据库文件损坏
# - 代码语法错误
```

### 端口被占用

```powershell
# 查看占用 80 端口的进程
netstat -ano | findstr :80

# 解决方案：修改 docker-compose.yml 端口映射
# ports: "8080:80"
```

### 健康检查失败

```powershell
# 手动测试后端是否正常
docker compose exec backend wget -qO- http://localhost:3000/api/health

# 查看后端日志
docker compose logs backend

# 进入容器排查
docker compose exec backend sh
```

### 数据不同步（Named Volume）

宿主机修改 `.md` 文件后容器看不到变更：

```powershell
# 原因：Named Volume 和宿主机是两份独立数据

# 解决方案一：改为 Bind Mount（见上方）
# 解决方案二：重新构建（会重建镜像，下次 down -v 后从新镜像复制）
docker compose down -v
docker compose up --build -d

# 注意：down -v 会删除卷中所有数据（包括管理后台上传的内容）
```

### 查看容器资源使用

```powershell
# 实时资源监控
docker stats

# 查看磁盘使用
docker system df

# 清理未使用的资源
docker system prune -f
```

---

## 文件清单

```
LemonParty/
├── docker-compose.yml              # 服务编排
├── Backend/
│   ├── Dockerfile                  # 后端镜像构建
│   └── .dockerignore               # 构建排除规则
├── Frontend/
│   ├── Dockerfile                  # 前端镜像构建
│   ├── nginx.conf                  # Nginx 配置
│   └── .dockerignore               # 构建排除规则
└── .dockerignore                   # 根目录构建排除规则
```
