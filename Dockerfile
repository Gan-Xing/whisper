# 使用ubuntu镜像作为基础镜像
FROM ubuntu:20.04

# 设置环境变量以避免交互式安装
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# 更新包列表并安装必要的工具
RUN apt-get update && apt-get install -y \
    tzdata \
    curl \
    python3 \
    python3-venv \
    python3-pip \
    build-essential \
    npm \
    ffmpeg

# 安装最新的 Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# 安装pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml 到工作目录
COPY package.json pnpm-lock.yaml ./

# 安装 Node.js 依赖
RUN pnpm install

# 复制所有项目文件到工作目录
COPY . .

# 构建Next.js应用程序
RUN pnpm run build

# 创建并激活Python虚拟环境，安装Python依赖
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir webrtcvad

# 设置环境变量
ENV NODE_ENV=production
ENV PATH="/app/venv/bin:$PATH"

# 暴露应用运行的端口
EXPOSE 3000 3001

# 定义运行时的命令
CMD ["pnpm", "start"]
