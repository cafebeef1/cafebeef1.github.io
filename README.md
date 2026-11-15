# Engineering Notes

技术博客，基于 GitHub Pages + Jekyll。

网站：https://cafebeef1.github.io/

## 内容组织

首页按技术专题组织内容。目前收录云网络专题，文章索引位于 `lessons/index.md`。后续可增设其他专题并在首页添加入口，现有文章 URL 不变。

## 新增文章

新建带 YAML front matter 的 Markdown 文件，设置 `layout: default`、`title` 和 `permalink`，并在对应专题索引添加导航。

架构图和网络拓扑图优先使用 draw.io：可编辑源文件放在 `diagrams/`，博客中的 SVG 放在 `assets/diagrams/`。仅在简短清晰、排版稳定时使用 ASCII 示意图。


### 统一绘图样式（C · 极简黑白）

- 所有复杂拓扑使用可编辑 `.drawio` + SVG；简单报文头、五元组和命令输出保留文本。
- 白底，矩形方角，无阴影；主体线条 `#262626`、边框 `#B8B8B8`、淡灰背景 `#F6F6F6`。
- 用 `#B45309` 琥珀色强调请求方向、重点变换或关键组件，不用大面积彩色填充。
- 实线箭头表示请求与实际转发方向，虚线用于返回路径、逻辑关系或规则下发（以图注说明为准）。
- 修改图片时，同时更新源文件与对应 SVG，所有标注保持一致。

## 部署

`main` 分支推送后，GitHub Actions 构建并部署到 GitHub Pages。仓库 Settings → Pages 的 Source 需要选择 **GitHub Actions**。
