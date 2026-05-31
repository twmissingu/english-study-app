/**
 * 晓华亲子英语 · 学习助手
 * 前端核心逻辑
 */

// PDF.js (loaded via script tag, available as global pdfjsLib)
function initPdfJs() {
  if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
  }
}

const MATERIAL_BASE = `${location.origin}/materials/`;

/** Encode file path for URL, preserving path separators */
function encodeFilePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

// ==================== DataManager ====================
class DataManager {
  constructor() {
    this.data = null;
  }

  async load() {
    const resp = await fetch("data.json");
    this.data = await resp.json();
  }

  getLevels() {
    return this.data.levels;
  }

  getLevel(name) {
    return this.data.levels.find((l) => l.name === name);
  }

  getWeeks(levelName) {
    const level = this.getLevel(levelName);
    return level ? level.weeks : [];
  }

  getDays(levelName, weekNumber) {
    const weeks = this.getWeeks(levelName);
    const week = weeks.find((w) => w.number === weekNumber);
    return week ? week.days : [];
  }

  getItems(levelName, weekNumber, dayNumber) {
    const days = this.getDays(levelName, weekNumber);
    const day = days.find((d) => d.number === dayNumber);
    return day ? day.items : [];
  }

  getWeekMeta(levelName, weekNumber) {
    const weeks = this.getWeeks(levelName);
    return weeks.find((w) => w.number === weekNumber) || null;
  }
}

// ==================== ProgressManager ====================
class ProgressManager {
  constructor() {
    this.storageKey = "english-study-progress";
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to load progress:", e);
    }
    return { version: 1, completed: {}, lastPosition: null, streak: 0, lastVisit: null };
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  checkin(level, week, day) {
    if (!this.data.completed[level]) this.data.completed[level] = {};
    if (!this.data.completed[level][week]) this.data.completed[level][week] = [];
    const arr = this.data.completed[level][week];
    if (!arr.includes(day)) {
      arr.push(day);
      arr.sort((a, b) => a - b);
    }
    this.updateStreak();
    this.save();
  }

  isChecked(level, week, day) {
    return (this.data.completed[level]?.[week] || []).includes(day);
  }

  getCompletedDays(level, week) {
    return this.data.completed[level]?.[week] || [];
  }

  getTotalCompletedDays() {
    let count = 0;
    for (const level of Object.values(this.data.completed)) {
      for (const days of Object.values(level)) {
        count += days.length;
      }
    }
    return count;
  }

  updateStreak() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const y = new Date(now.getTime() - 86400000);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;

    if (this.data.lastVisit === today) return;

    if (this.data.lastVisit === yesterday) {
      this.data.streak += 1;
    } else if (this.data.lastVisit !== today) {
      this.data.streak = 1;
    }
    this.data.lastVisit = today;
  }

  getStreak() {
    return this.data.streak || 0;
  }

  savePosition(level, week, day) {
    this.data.lastPosition = { level, week, day };
    this.save();
  }

  getLastPosition() {
    return this.data.lastPosition;
  }
}

// ==================== Navigation ====================
class Navigation {
  constructor(dataManager, progressManager, onNavigate) {
    this.dm = dataManager;
    this.pm = progressManager;
    this.onNavigate = onNavigate;

    this.currentLevel = null;
    this.currentWeek = null;
    this.currentDay = null;

    this.levelSelect = document.getElementById("level-select");
    this.weekList = document.getElementById("week-list");
    this.dayList = document.getElementById("day-list");

    this.levelSelect.addEventListener("change", () => this.onLevelChange());
  }

  init() {
    const levels = this.dm.getLevels();
    this.levelSelect.innerHTML = levels
      .map((l) => `<option value="${l.name}">${l.name}</option>`)
      .join("");

    // Restore last position or default to first
    const last = this.pm.getLastPosition();
    if (last && this.dm.getLevel(last.level)) {
      this.currentLevel = last.level;
      this.currentWeek = last.week;
      this.currentDay = last.day;
    } else {
      this.currentLevel = levels[0].name;
      const weeks = this.dm.getWeeks(this.currentLevel);
      this.currentWeek = weeks.length ? weeks[0].number : null;
      const days = this.dm.getDays(this.currentLevel, this.currentWeek);
      this.currentDay = days.length ? days[0].number : null;
    }

    this.levelSelect.value = this.currentLevel;
    this.renderWeeks();
    this.renderDays();
    this.navigate();
  }

  onLevelChange() {
    this.currentLevel = this.levelSelect.value;
    const weeks = this.dm.getWeeks(this.currentLevel);
    this.currentWeek = weeks.length ? weeks[0].number : null;
    const days = this.dm.getDays(this.currentLevel, this.currentWeek);
    this.currentDay = days.length ? days[0].number : null;
    this.renderWeeks();
    this.renderDays();
    this.navigate();
  }

  renderWeeks() {
    const weeks = this.dm.getWeeks(this.currentLevel);
    this.weekList.innerHTML = weeks
      .map((w) => {
        const active = w.number === this.currentWeek ? "active" : "";
        const theme = w.theme ? `<span class="week-theme">${escHtml(w.theme)}</span>` : "";
        return `<li class="${active}" data-week="${w.number}">
          第${w.number}周 ${theme}
        </li>`;
      })
      .join("");

    this.weekList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", () => {
        this.currentWeek = parseInt(li.dataset.week);
        const days = this.dm.getDays(this.currentLevel, this.currentWeek);
        this.currentDay = days.length ? days[0].number : null;
        this.renderWeeks();
        this.renderDays();
        this.navigate();
      });
    });
  }

  renderDays() {
    const days = this.dm.getDays(this.currentLevel, this.currentWeek);
    this.dayList.innerHTML = days
      .map((d) => {
        const active = d.number === this.currentDay ? "active" : "";
        const checked = this.pm.isChecked(this.currentLevel, this.currentWeek, d.number);
        const checkMark = checked ? '<span class="check-mark">✓</span>' : "";
        return `<li class="${active}" data-day="${d.number}">
          Day${d.number} ${escHtml(d.name)} ${checkMark}
        </li>`;
      })
      .join("");

    this.dayList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", () => {
        this.currentDay = parseInt(li.dataset.day);
        this.renderDays();
        this.navigate();
      });
    });
  }

  navigate() {
    if (this.currentLevel && this.currentWeek != null && this.currentDay != null) {
      this.pm.savePosition(this.currentLevel, this.currentWeek, this.currentDay);
      this.onNavigate(this.currentLevel, this.currentWeek, this.currentDay);
    }
  }

  refresh() {
    this.renderDays();
  }
}

// ==================== ContentRenderer ====================
class ContentRenderer {
  constructor(dataManager, progressManager) {
    this.dm = dataManager;
    this.pm = progressManager;
    this.container = document.getElementById("items-container");
    this.titleEl = document.getElementById("current-title");
    this.progressEl = document.getElementById("week-progress");
    this.actionBar = document.getElementById("action-bar");
    this.checkinBtn = document.getElementById("checkin-btn");
    this.playBtn = document.getElementById("play-btn");

    this.currentItems = [];
    this.currentLevel = null;
    this.currentWeek = null;
    this.currentDay = null;
    this.autoPlayer = null;
  }

  render(level, week, day) {
    this.currentLevel = level;
    this.currentWeek = week;
    this.currentDay = day;

    const items = this.dm.getItems(level, week, day);
    this.currentItems = items;

    const weekMeta = this.dm.getWeekMeta(level, week);
    const days = this.dm.getDays(level, week);
    const completedDays = this.pm.getCompletedDays(level, week);

    this.titleEl.textContent = weekMeta?.theme
      ? `第${week}周 · ${weekMeta.theme}`
      : `第${week}周`;

    this.progressEl.textContent = `Day${day} · 已完成 ${completedDays.length}/${days.length} 天`;

    // Render items
    if (items.length === 0) {
      this.container.innerHTML = `<div class="empty-state"><p>暂无内容 (${level} 第${week}周 Day${day})</p></div>`;
      this.actionBar.classList.add("hidden");
      return;
    }

    this.container.innerHTML = items
      .map((item, idx) => this.renderItem(item, idx))
      .join("");

    // Bind click handlers
    this.container.querySelectorAll(".item-header").forEach((header) => {
      header.addEventListener("click", () => {
        const idx = parseInt(header.dataset.index);
        this.toggleItem(idx);
      });
    });

    // Show action bar
    this.actionBar.classList.remove("hidden");
    this.updateCheckinButton();

    // Expand all items by default
    items.forEach((_, idx) => {
      this.expandItem(idx);
    });
  }

  renderItem(item, idx) {
    const icons = {
      image: "📄",
      audio: "🎵",
      video: "🎬",
      pdf: "📕",
      document: "📝",
      slide: "📊",
    };
    const icon = icons[item.type] || "📁";
    const label = item.label || item.type;

    return `
      <div class="content-item" data-index="${idx}" id="item-${idx}">
        <div class="item-header" data-index="${idx}">
          <span class="item-type-icon">${icon}</span>
          <span class="item-title">${escHtml(label)}</span>
          <span class="item-id">${item.id}</span>
          <span class="item-toggle">▶</span>
        </div>
        <div class="item-body" id="item-body-${idx}"></div>
      </div>`;
  }

  toggleItem(idx) {
    const body = document.getElementById(`item-body-${idx}`);
    const toggle = this.container.querySelector(
      `.content-item[data-index="${idx}"] .item-toggle`
    );
    if (body.classList.contains("open")) {
      body.classList.remove("open");
      toggle.classList.remove("open");
      this.stopItem(idx);
    } else {
      this.expandItem(idx);
    }
  }

  expandItem(idx) {
    const item = this.currentItems[idx];
    if (!item) return;

    const body = document.getElementById(`item-body-${idx}`);
    const toggle = this.container.querySelector(
      `.content-item[data-index="${idx}"] .item-toggle`
    );
    body.classList.add("open");
    toggle.classList.add("open");

    // Don't re-render if already has content
    if (body.children.length > 0) return;

    switch (item.type) {
      case "image":
        this.renderImages(body, item);
        break;
      case "audio":
        this.renderAudio(body, item, idx);
        break;
      case "video":
        this.renderVideo(body, item, idx);
        break;
      case "pdf":
        this.renderPDF(body, item);
        break;
      case "document":
        this.renderDocument(body, item);
        break;
      case "slide":
        body.innerHTML = '<div class="slide-notice">📊 请用其他应用查看 PPT 文件</div>';
        break;
    }
  }

  stopItem(idx) {
    const body = document.getElementById(`item-body-${idx}`);
    const audio = body.querySelector("audio");
    const video = body.querySelector("video");
    if (audio) audio.pause();
    if (video) video.pause();
  }

  renderImages(container, item) {
    const files = item.files;
    let current = 0;

    container.innerHTML = `
      <div class="image-viewer">
        <img src="${MATERIAL_BASE}${encodeFilePath(files[0])}" alt="${escHtml(item.label)}" draggable="false" />
        <div class="image-controls">
          <button class="img-prev">◀</button>
          <span class="img-counter">1 / ${files.length}</span>
          <button class="img-next">▶</button>
          <button class="img-reset">重置</button>
        </div>
      </div>`;

    const viewer = container.querySelector(".image-viewer");
    const img = container.querySelector("img");
    const counter = container.querySelector(".img-counter");

    const show = (i) => {
      current = (i + files.length) % files.length;
      img.src = MATERIAL_BASE + encodeFilePath(files[current]);
      counter.textContent = `${current + 1} / ${files.length}`;
      resetZoom();
    };

    container.querySelector(".img-prev").addEventListener("click", () => show(current - 1));
    container.querySelector(".img-next").addEventListener("click", () => show(current + 1));

    // --- Pinch-to-zoom & scroll-to-zoom ---
    let scale = 1, panX = 0, panY = 0;
    let lastDist = 0, lastPanX = 0, lastPanY = 0;
    let isPanning = false;

    const applyTransform = () => {
      img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    };

    const resetZoom = () => {
      scale = 1; panX = 0; panY = 0;
      applyTransform();
    };

    container.querySelector(".img-reset").addEventListener("click", resetZoom);

    // Mouse wheel zoom
    viewer.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale = Math.min(Math.max(scale * delta, 0.5), 5);
      if (scale <= 1) { panX = 0; panY = 0; }
      applyTransform();
    }, { passive: false });

    // Touch pinch-to-zoom
    const getTouchDist = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    viewer.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        lastDist = getTouchDist(e.touches);
      } else if (e.touches.length === 1 && scale > 1) {
        isPanning = true;
        lastPanX = e.touches[0].clientX;
        lastPanY = e.touches[0].clientY;
      }
    }, { passive: true });

    viewer.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const delta = dist / lastDist;
        scale = Math.min(Math.max(scale * delta, 0.5), 5);
        lastDist = dist;
        applyTransform();
      } else if (e.touches.length === 1 && isPanning) {
        e.preventDefault();
        panX += e.touches[0].clientX - lastPanX;
        panY += e.touches[0].clientY - lastPanY;
        lastPanX = e.touches[0].clientX;
        lastPanY = e.touches[0].clientY;
        applyTransform();
      }
    }, { passive: false });

    viewer.addEventListener("touchend", () => {
      isPanning = false;
      if (scale <= 1) { panX = 0; panY = 0; scale = 1; applyTransform(); }
    }, { passive: true });

    // Mouse drag to pan (when zoomed)
    viewer.addEventListener("mousedown", (e) => {
      if (scale > 1) {
        isPanning = true;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        e.preventDefault();
      }
    });

    viewer.addEventListener("mousemove", (e) => {
      if (isPanning) {
        panX += e.clientX - lastPanX;
        panY += e.clientY - lastPanY;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        applyTransform();
      }
    });

    viewer.addEventListener("mouseup", () => { isPanning = false; });
    viewer.addEventListener("mouseleave", () => { isPanning = false; });
  }

  renderAudio(container, item, idx) {
    const src = item.files[0];
    container.innerHTML = `
      <div class="audio-player">
        <audio controls preload="metadata" src="${MATERIAL_BASE}${encodeFilePath(src)}"></audio>
      </div>`;

    const audio = container.querySelector("audio");
    audio.addEventListener("ended", () => {
      if (this.autoPlayer) this.autoPlayer.onItemEnded(idx);
    });
  }

  renderVideo(container, item, idx) {
    const src = item.files[0];
    container.innerHTML = `
      <div class="video-player">
        <video controls playsinline preload="metadata"
          src="${MATERIAL_BASE}${encodeFilePath(src)}"></video>
      </div>`;

    const video = container.querySelector("video");
    video.addEventListener("ended", () => {
      if (this.autoPlayer) this.autoPlayer.onItemEnded(idx);
    });
  }

  async renderPDF(container, item) {
    const src = item.files[0];
    container.innerHTML = `
      <div class="pdf-viewer">
        <canvas class="pdf-canvas"></canvas>
        <div class="pdf-controls">
          <button class="pdf-prev">◀ 上一页</button>
          <span class="pdf-page">加载中...</span>
          <button class="pdf-next">下一页 ▶</button>
        </div>
      </div>`;

    const canvas = container.querySelector(".pdf-canvas");
    const pageSpan = container.querySelector(".pdf-page");
    const prevBtn = container.querySelector(".pdf-prev");
    const nextBtn = container.querySelector(".pdf-next");

    let pdfDoc = null;
    let pageNum = 1;
    let pdfScale = 1.5;

    const renderPage = async (num) => {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: pdfScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageSpan.textContent = `第 ${num} 页 / 共 ${pdfDoc.numPages} 页`;
      prevBtn.disabled = num <= 1;
      nextBtn.disabled = num >= pdfDoc.numPages;
    };

    try {
      const url = MATERIAL_BASE + encodeFilePath(src);
      const pdf = await pdfjsLib.getDocument(url).promise;
      pdfDoc = pdf;
      await renderPage(pageNum);

      prevBtn.addEventListener("click", () => {
        if (pageNum > 1) renderPage(--pageNum);
      });
      nextBtn.addEventListener("click", () => {
        if (pageNum < pdfDoc.numPages) renderPage(++pageNum);
      });
    } catch (e) {
      pageSpan.textContent = "PDF 加载失败";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    }
  }

  renderDocument(container, item) {
    const div = document.createElement("div");
    div.className = "document-content";
    if (item.content) {
      // Sanitize: only allow safe HTML tags
      const temp = document.createElement("div");
      temp.innerHTML = item.content;
      temp.querySelectorAll("script, style, iframe, [onerror], [onclick], [onload]").forEach(el => el.remove());
      temp.querySelectorAll("*").forEach(el => {
        [...el.attributes].forEach(attr => {
          if (attr.name.startsWith("on")) el.removeAttribute(attr.name);
        });
      });
      // Use appendChild to avoid re-parsing sanitized HTML
      while (temp.firstChild) {
        div.appendChild(temp.firstChild);
      }
    } else {
      div.textContent = "（无内容）";
    }
    container.appendChild(div);
  }

  setActiveItem(idx) {
    this.container.querySelectorAll(".content-item").forEach((el, i) => {
      el.classList.toggle("active", i === idx);
    });
  }

  updateCheckinButton() {
    const checked = this.pm.isChecked(this.currentLevel, this.currentWeek, this.currentDay);
    this.checkinBtn.textContent = checked ? "✓ 已完成" : "✓ 今日完成";
    this.checkinBtn.classList.toggle("checked", checked);
  }
}

// ==================== AutoPlayer ====================
class AutoPlayer {
  constructor(contentRenderer, navigation) {
    this.cr = contentRenderer;
    this.nav = navigation;
    this.isPlaying = false;
    this.currentIndex = 0;
    this.cr.autoPlayer = this;
  }

  start() {
    this.isPlaying = true;
    this.currentIndex = 0;
    this.cr.playBtn.textContent = "⏸ 暂停";
    this.playItem(0);
  }

  stop() {
    this.isPlaying = false;
    this.cr.playBtn.textContent = "▶ 继续";
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  playItem(idx) {
    const items = this.cr.currentItems;
    if (idx >= items.length) {
      this.isPlaying = false;
      this.cr.playBtn.textContent = "▶ 开始今天";
      return;
    }

    this.currentIndex = idx;
    this.cr.expandItem(idx);
    this.cr.setActiveItem(idx);

    // Scroll into view
    const el = document.getElementById(`item-${idx}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const item = items[idx];

    // Auto-play for image: advance after 5s
    if (item.type === "image") {
      setTimeout(() => {
        if (this.isPlaying) this.playItem(idx + 1);
      }, 5000);
    }

    // PDF and document: don't auto-advance
    if (item.type === "pdf" || item.type === "document" || item.type === "slide") {
      this.stop();
    }
  }

  onItemEnded(idx) {
    if (!this.isPlaying) return;
    // Move to next item
    this.playItem(idx + 1);
  }

  jumpTo(idx) {
    this.isPlaying = false;
    this.cr.playBtn.textContent = "▶ 继续";
    this.cr.expandItem(idx);
    this.cr.setActiveItem(idx);
    const el = document.getElementById(`item-${idx}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// ==================== Stats ====================
function updateStats(pm) {
  document.getElementById("stat-days").innerHTML =
    `📚 已学 <strong>${pm.getTotalCompletedDays()}</strong> 天`;
  document.getElementById("stat-streak").innerHTML =
    `🔥 连续 <strong>${pm.getStreak()}</strong> 天`;
}

// ==================== Utils ====================
function escHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ==================== App ====================
class App {
  constructor() {
    this.dm = new DataManager();
    this.pm = new ProgressManager();
    this.cr = new ContentRenderer(this.dm, this.pm);
    this.nav = new Navigation(this.dm, this.pm, (level, week, day) => {
      this.cr.render(level, week, day);
      updateStats(this.pm);
    });
    this.autoPlayer = new AutoPlayer(this.cr, this.nav);

    this.bindEvents();
  }

  bindEvents() {
    // Play button
    document.getElementById("play-btn").addEventListener("click", () => {
      this.autoPlayer.toggle();
    });

    // Checkin button
    document.getElementById("checkin-btn").addEventListener("click", () => {
      this.pm.checkin(this.nav.currentLevel, this.nav.currentWeek, this.nav.currentDay);
      this.cr.updateCheckinButton();
      this.nav.refresh();
      updateStats(this.pm);
    });

    // Sidebar toggle (mobile)
    document.getElementById("sidebar-toggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });

    // Close sidebar on content click (mobile)
    document.getElementById("content").addEventListener("click", () => {
      document.getElementById("sidebar").classList.remove("open");
    });
  }

  async init() {
    try {
      initPdfJs();
      await this.dm.load();
      this.nav.init();
      updateStats(this.pm);
    } catch (e) {
      document.getElementById("items-container").innerHTML =
        `<div class="empty-state"><p>❌ 加载失败: ${escHtml(e.message)}</p></div>`;
    }
  }
}

// ==================== Bootstrap ====================
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
