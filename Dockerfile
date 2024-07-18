# 使用ubuntu镜像作为基础镜像
FROM ubuntu:22.04

# 设置环境变量以避免交互式安装
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# 更新包列表并安装必要的工具
RUN apt-get update && apt-get install -y --fix-missing \
    tzdata \
    curl \
    python3 \
    python3-venv \
    python3-pip \
    build-essential \
    software-properties-common \
    npm

# 添加最新的FFmpeg PPA并安装FFmpeg
RUN add-apt-repository ppa:ubuntuhandbook1/ffmpeg7 && \
    apt-get update && \
    apt-get install -y --fix-missing ffmpeg

# 删除所有 libnode 相关的包
RUN apt-get remove -y libnode* nodejs* npm

# 安装最新的 Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --fix-missing nodejs

# 安装 pnpm 和 nrm，并使用淘宝源
RUN npm install -g pnpm nrm && \
    nrm use taobao

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml 到工作目录
COPY package.json pnpm-lock.yaml ./

# 安装 Node.js 依赖
RUN pnpm install

# 复制所有项目文件到工作目录
COPY . .

# 设置环境变量
ENV NODE_ENV=production

# 构建Next.js应用程序
RUN pnpm run build

# 创建并激活Python虚拟环境，安装Python依赖
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir webrtcvad

# 设置环境变量
ENV PATH="/app/venv/bin:$PATH"

# 暴露应用运行的端口
EXPOSE 3000 3001

# 定义运行时的命令
CMD ["pnpm", "start"]
