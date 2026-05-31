[![English](https://img.shields.io/badge/English-blue.svg)](README.md)
[![中文](https://img.shields.io/badge/中文-red.svg)](README_zh.md)

---

# 英语学习助手

告别逐个文件点击打开——一个浏览器标签页搞定所有教学素材展示。

## 为什么做这个？

你有几百个整理好的英语学习文件（音频、视频、PDF、图片），散落在几十个文件夹里。一个个打开太痛苦了。这个应用扫描你的素材目录，自动建立索引，以清爽的网页界面展示一切——支持播放、进度记录、iPad 访问。

**零依赖、零配置、双击即用。**

## 功能

- 📂 自动扫描素材目录 → 结构化导航（级别→周→天）
- 🎵 音频/视频播放器，播完自动播放下一个
- 📕 PDF 阅读器（PDF.js），支持翻页
- 📝 DOCX 歌词/译文内嵌显示
- 🖼️ 图片查看器，支持双指缩放
- ✅ 打卡功能 + 学习统计（天数、连续天数）
- 💾 进度记忆（下次打开自动恢复位置）
- 📱 iPad 通过局域网访问（响应式布局）
- 🔒 路径穿越防护、XSS 消毒

## 快速开始

### 前置条件

- Python 3.10+（macOS 自带）
- 一个整理好的英语学习素材目录

### 使用

```bash
# 克隆仓库
git clone https://github.com/twmissingu/english-study-app.git
cd english-study-app

# 编辑 serve.py — 设置 MATERIAL_DIR 为你的素材目录
# 默认：~/Documents/zyn/english-study

# 双击 start.command，或运行：
python3 serve.py
```

浏览器自动打开 `http://localhost:8080`。

### iPad 访问

1. iPad 连接同一个 WiFi
2. Safari 输入终端显示的地址（如 `http://192.168.x.x:8080`）

## 素材目录结构

```
你的素材/
├── 级别1/
│   ├── 第1周/
│   │   ├── Day1-主题/
│   │   │   ├── 01-讲义.jpg
│   │   │   ├── 02-讲解.mp3
│   │   │   ├── 03-儿歌.mp4
│   │   │   └── 04-打卡.png
│   │   ├── Day2-主题/
│   │   └── ...
│   └── 第2周/
└── 级别2/
```

按扩展名自动识别：jpg/png → 图片，mp3/wav → 音频，mp4/mov → 视频，pdf → PDF，docx → 文档。

## 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 服务器 | Python `http.server` | macOS 自带，零依赖 |
| 索引 | `os.walk` + `python-docx` | 扫描目录 + 提取 DOCX |
| 前端 | 原生 HTML/CSS/JS | 无需框架 |
| PDF | PDF.js v3（离线） | 浏览器原生渲染 |
| 存储 | localStorage | 零配置持久化 |

## 许可证

[MIT](LICENSE)
