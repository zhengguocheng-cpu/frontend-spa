#!/bin/bash

# 前端部署脚本 - 避免 package-lock.json 被修改

echo "🚀 开始部署 frontend-spa..."

# 1. 检查 npm 版本
echo "📦 检查 npm 版本..."
npm -v

# 2. 使用 ci 命令安装依赖（不会修改 package-lock.json）
echo "📥 安装依赖（使用 npm ci）..."
npm ci

# 3. 构建项目
echo "🔨 构建项目..."
npm run build

# 4. 检查 package-lock.json 是否被修改
if git diff --quiet package-lock.json; then
  echo "✅ package-lock.json 未被修改"
else
  echo "⚠️  警告：package-lock.json 被修改了！"
  echo "建议：统一本地和服务器的 npm 版本"
fi

echo "🎉 部署完成！"
