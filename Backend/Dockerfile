# 构建阶段 - 使用 Debian 安装编译工具更快
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# 替换 apt 源为阿里云镜像
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

# 安装构建工具（better-sqlite3 需要 Python 和编译工具）
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# 生产阶段 - 最小化镜像
FROM node:20-bookworm-slim
WORKDIR /app

# 从构建阶段复制 node_modules（包含编译好的原生模块）
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["node", "src/index.js"]
