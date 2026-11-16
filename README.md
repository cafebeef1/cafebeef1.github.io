# rand0m.

GitHub Pages + Jekyll 个人站点：https://cafebeef1.github.io/

> 诗酒趁年华。保持好奇，持续探索。

## 网站内容

- **技术**：`lessons/`，现有云网络系列 URL 保持不变
- **诗词**：`poetry/works/`，按作者、朝代、体裁和题材筛选
- **阅读**：`books/`
- **运动**：`sports/`
- **归档**：`archive/`，基于内容元数据自动生成

首页为 `index.html`；全站布局位于 `_layouts/default.html`，样式位于 `assets/style.css`，诗词筛选使用 `assets/site.js`。不需要额外的 JavaScript 构建工具。

## 新增诗词

在 `poetry/works/` 新增 Markdown 文件，头部字段参考已有作品：

```yaml
---
layout: default
kind: poem
section: poetry
title: "作品名"
permalink: /poetry/unique-slug/
author: "作者"
dynasty: "朝代"
form: "诗"
themes: ["山水", "哲理"]
tags: ["春景"]
excerpt: "代表诗句"
summary: "简介"
cover: /assets/poetry/unique-slug.webp
cover_alt: "配图文字描述"
updated: 2026-11-17
show_in_updates: true
featured: false
order: 10
---
```

添加新作者、朝代、体裁或题材无需修改筛选器：诗词目录从作品元数据自动生成所有筛选选项。`cover` 可以使用站内 SVG、WebP 或 AVIF 图像，当前首批作品配图为原创生成的国画风 WebP 意境插画，原先 SVG 仍保留在仓库中作为历史版本。诗词阅读页使用独立的东方美学排版。

## 新增技术文章

在 `lessons/` 创建带 YAML front matter 的 Markdown 页面。保留 `permalink` 以避免链接变化。添加 `section: tech`、`updated: YYYY-MM-DD` 和 `show_in_updates: true` 可以让其自动出现在首页最近更新与归档中。

## 绘图风格

技术架构图沿用 **A · 现代简约** 规范：

- 复杂拓扑：`diagrams/` 存 draw.io 可编辑文件，`assets/diagrams/` 存 SVG 输出。
- 浅蓝 `#EEF6FF`、浅绿 `#ECF9F3`、白色背景，圆角矩形，无阴影。
- 转发请求用蓝/绿实线，回包与逻辑关联用灰色虚线，避免箭头与文字交叠。
- 简短清晰的报文头、五元组、命令输出可以继续用文本或 ASCII。

诗词插画使用独立的低饱和东方美学风格，不套用技术图规范。

## 部署

`main` 分支推送后由 `.github/workflows/pages.yml` 使用 Jekyll 构建并部署。GitHub 仓库 Settings → Pages 的 Source 选择 **GitHub Actions**。
