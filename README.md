# Image Background Remover

一键去除图片背景，基于 Remove.bg API，部署在 Cloudflare Pages。

## 技术栈

- Next.js 16 + TypeScript
- Tailwind CSS v4
- Cloudflare Pages（部署）
- Remove.bg API（背景去除引擎）

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 Remove.bg API Key

# 3. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 部署到 Cloudflare Pages

1. 将仓库连接到 Cloudflare Pages
2. 构建命令：`npm run build`
3. 输出目录：`.next`
4. 在 Cloudflare Pages 环境变量中添加 `REMOVE_BG_API_KEY`

## 获取 Remove.bg API Key

前往 https://www.remove.bg/api 注册，免费版每月 50 次。
