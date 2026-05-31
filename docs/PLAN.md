# PLAN: 晓华亲子英语 · 学习助手

## 技术架构

```
english-study/
├── start.command              ← macOS 双击启动脚本
├── serve.py                   ← Python：扫描目录 + 启动 HTTP 服务器
├── static/
│   ├── index.html             ← 单页应用入口
│   ├── app.js                 ← 前端核心逻辑
│   ├── style.css              ← 样式
│   └── vendor/
│       └── pdfjs/             ← PDF.js 离线包
├── data.json                  ← 启动时自动生成的目录索引
└── [原始素材目录，只读不动]
    ├── 预备级/
    ├── 基础级/
    ├── 陪伴营 1阶/
    ├── 陪伴营 2阶/
    ├── 陪伴营 3阶/
    └── 陪伴营 4阶/
```

### 技术栈

| 组件 | 技术 | 理由 |
|------|------|------|
| 服务器 | Python3 `http.server` | macOS 自带，零依赖 |
| 索引生成 | Python3 `os.walk` + `python-docx` | 扫描目录 + 提取 DOCX 内容 |
| 前端框架 | 无（原生 HTML/CSS/JS） | 复杂度低，无需引入框架 |
| PDF 渲染 | PDF.js v4.x（离线） | 浏览器内 PDF 渲染标准方案 |
| 进度存储 | localStorage | 零依赖，浏览器原生支持 |

---

## 实现阶段

### Phase 1: 索引生成脚本（serve.py）

**目标：** 扫描素材目录，生成结构化的 `data.json`

**产出文件：** `serve.py`

**核心逻辑：**

```python
# 1. 扫描目录结构
# 2. 解析每级的周次和天次
# 3. 识别文件类型（图片/音频/视频/PDF/DOCX/PPTX）
# 4. 提取 DOCX 内容为 HTML（python-docx）
# 5. 输出 data.json
# 6. 启动 HTTP 服务器
```

**data.json 结构：**

```json
{
  "levels": [
    {
      "name": "预备级",
      "weeks": [
        {
          "number": 1,
          "theme": "主题儿歌 Old MacDonald",
          "days": [
            {
              "number": 1,
              "name": "主题儿歌",
              "items": [
                {
                  "id": "01",
                  "type": "image",
                  "label": "讲义",
                  "files": ["path/to/01-讲义01.png", "path/to/01-讲义02.png"]
                },
                {
                  "id": "02",
                  "type": "audio",
                  "label": "讲解",
                  "files": ["path/to/02-讲解.mp3"]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "serverIP": "192.168.x.x",
  "generatedAt": "2026-05-31T12:00:00"
}
```

**文件类型识别规则：**

| 扩展名 | type |
|--------|------|
| jpg, jpeg, png, gif, webp | image |
| mp3, wav, m4a, ogg | audio |
| mp4, mov, webm | video |
| pdf | pdf |
| docx | document |
| pptx | slide |

**DOCX 提取：**
- 使用 `python-docx` 读取段落和表格
- 输出为简单 HTML（`<p>`, `<b>`, `<br>`）
- 嵌入 data.json 的 `content` 字段

**服务器启动：**
- 端口 8080（可配置）
- 绑定 0.0.0.0（允许局域网访问）
- 自动检测本机 IP 地址
- 自动打开浏览器

---

### Phase 2: 前端页面（index.html + style.css）

**目标：** 构建单页应用的 HTML 结构和样式

**产出文件：** `index.html`, `style.css`

**页面结构：**

```html
<body>
  <header>
    <h1>晓华亲子英语 · 学习助手</h1>
    <div id="stats"><!-- 学习统计 --></div>
  </header>
  <main>
    <aside id="sidebar">
      <select id="level-select"><!-- 级别选择 --></select>
      <ul id="week-list"><!-- 周次列表 --></ul>
      <ul id="day-list"><!-- 天次列表 --></ul>
    </aside>
    <section id="content">
      <h2 id="current-title"><!-- 当前课程标题 --></h2>
      <div id="items-container">
        <!-- 按编号顺序渲染的内容项 -->
      </div>
      <button id="checkin-btn">✓ 今日完成</button>
    </section>
  </main>
</body>
```

**样式设计：**
- 左侧导航栏：固定宽度 280px，可收起
- 右侧内容区：自适应宽度
- 配色：温暖柔和，适合亲子场景
- 字体：大字号，易读
- 响应式断点：768px（平板）、1024px（桌面）

**内容项渲染规则：**

| type | 展示方式 |
|------|----------|
| image | 图片轮播容器，支持多图 |
| audio | `<audio>` 播放器，带标题 |
| video | `<video>` 播放器，playsinline |
| pdf | PDF.js 渲染容器，带翻页控件 |
| document | 内嵌 HTML 内容（已从 DOCX 转换） |
| slide | 提示"请用其他应用查看" |

---

### Phase 3: 前端逻辑（app.js）

**目标：** 实现导航、播放控制、进度管理

**产出文件：** `app.js`

**模块划分：**

```
app.js
├── DataManager      ← 加载 data.json，提供查询接口
├── Navigation       ← 左侧导航：级别/周/天切换
├── ContentRenderer  ← 右侧内容区渲染
├── AutoPlayer       ← 自动播放控制
├── ProgressManager  ← 进度存储和打卡
└── App              ← 主入口，初始化和事件绑定
```

#### DataManager
- `load()` — fetch data.json
- `getLevels()` — 返回级别列表
- `getWeeks(level)` — 返回某级别的周列表
- `getDays(level, week)` — 返回某周的天列表
- `getItems(level, week, day)` — 返回某天的内容项列表

#### Navigation
- 级别下拉切换 → 更新周列表
- 周次点击 → 更新天列表 + 加载第一天内容
- 天次点击 → 加载当天内容
- 已打卡天次显示 ✓ 标记

#### ContentRenderer
- `render(items)` — 按编号顺序渲染所有内容项
- 每项默认折叠，只显示标题和类型图标
- 点击展开：加载对应播放器/查看器
- 当前播放项高亮

#### AutoPlayer
- `start()` — 从第一项开始自动播放
- `next()` — 播完当前项后自动展开并播放下一项
- `jumpTo(index)` — 手动跳转到某项
- 图片项：自动轮播，每张 5 秒
- 音频/视频项：监听 `ended` 事件触发 next()
- PDF 项：不自动推进，等待手动点击

#### ProgressManager
- `load()` — 从 localStorage 读取进度
- `save()` — 写入 localStorage
- `checkin(level, week, day)` — 标记某天完成
- `isChecked(level, week, day)` — 查询是否已打卡
- `getStats()` — 返回统计数据（总天数、已完成、连续天数）
- `savePosition(level, week, day)` — 记录当前位置
- `getLastPosition()` — 获取上次位置

**localStorage 数据结构：**

```json
{
  "version": 1,
  "currentLevel": "陪伴营 1阶",
  "currentWeek": 3,
  "currentDay": 2,
  "completed": {
    "预备级": { "1": [1, 2, 3], "2": [1] },
    "陪伴营 1阶": { "1": [1, 2, 3, 4, 5, 6, 7], "2": [1, 2] }
  },
  "streak": 5,
  "lastVisit": "2026-05-31"
}
```

---

### Phase 4: PDF.js 集成

**目标：** 内嵌 PDF 阅读能力

**产出文件：** `static/vendor/pdfjs/` 目录

**步骤：**
1. 下载 PDF.js v4.x 离线包（pdf.min.js + pdf.worker.min.js）
2. 放入 `static/vendor/pdfjs/`
3. 在 app.js 中实现 PDF 渲染逻辑：
   - `loadPDF(url)` — 加载 PDF 文件
   - `renderPage(pageNum)` — 渲染指定页到 canvas
   - `prevPage()` / `nextPage()` — 翻页
   - `zoomIn()` / `zoomOut()` — 缩放

---

### Phase 5: 启动脚本

**目标：** 一键启动体验

**产出文件：** `start.command`

```bash
#!/bin/bash
cd "$(dirname "$0")"
python3 serve.py
```

**serve.py 启动流程：**
1. 检查 python-docx 是否安装，未安装则自动 pip install
2. 扫描素材目录生成 data.json
3. 检测本机 IP 地址
4. 打印访问地址（本地 + 局域网）
5. 启动 HTTP 服务器
6. 自动打开浏览器

---

### Phase 6: 测试与优化

**测试内容：**
- [ ] 6 个级别都能正确导航
- [ ] 每天的内容按编号顺序展示
- [ ] 音频自动播放下一个
- [ ] 视频在 iOS Safari 上正常播放（playsinline）
- [ ] PDF 翻页和缩放正常
- [ ] DOCX 内容正确提取和显示
- [ ] 打卡功能正常
- [ ] 进度持久化（刷新后恢复）
- [ ] iPad 通过局域网访问正常
- [ ] 响应式布局在不同尺寸下正常

**性能优化：**
- data.json 按需加载（不阻塞首屏）
- 图片懒加载（只加载当前展开项的图片）
- 音视频不预加载（节省带宽）
- PDF 按需渲染（只渲染当前页）

---

## 开发顺序

```
Phase 1 (serve.py)       ← 先有数据
    ↓
Phase 2 (HTML+CSS)       ← 先有页面骨架
    ↓
Phase 3 (app.js)         ← 核心交互逻辑
    ↓
Phase 4 (PDF.js)         ← PDF 渲染
    ↓
Phase 5 (start.command)  ← 启动体验
    ↓
Phase 6 (测试优化)        ← 质量保障
```

**预估工作量：**
- Phase 1: ~150 行 Python
- Phase 2: ~200 行 HTML + ~300 行 CSS
- Phase 3: ~500 行 JS
- Phase 4: PDF.js 集成 ~100 行 JS
- Phase 5: ~30 行 shell + ~50 行 Python
- Phase 6: 手动测试

**总计约 1,330 行代码，无外部运行时依赖。**
