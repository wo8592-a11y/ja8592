(() => {
  const $ = (id) => document.getElementById(id);
  const files = [];
  let currentId = null;
  let viewZoom = 1;
  let drawing = false;
  let lastPt = null;
  let lineStart = null;
  let cropRect = null;
  let dragOverlay = null;
  let selectedOv = null;
  let selectedPhoto = true;
  const quadSlots = [null, null, null, null];

  const STICKERS = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚",
    "😎", "🤓", "🧐", "🤔", "😮", "😢", "😭", "😡", "🤯", "🥳", "😴", "🤗", "👍", "👎", "👏", "🙏",
    "💪", "👀", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💯", "⭐", "🌟", "✨", "⚡",
    "🔥", "🌈", "☀️", "🌙", "☁️", "❄️", "🌊", "⚓", "🚢", "⛵", "🧭", "🐟", "🐳", "🐬", "🐙", "🦀",
    "🌴", "🌸", "🌺", "🌻", "🍀", "🍁", "🍎", "🍕", "🍰", "☕", "🎓", "📷", "🎥", "🎵", "🎮", "⚽",
    "🏆", "🎯", "🎉", "🎁", "🎈", "💡", "📌", "✅", "❌", "❓", "➡️", "⬅️", "⬆️", "⬇️", "📍", "💎",
    "👑", "🕶️", "🧢", "🧸", "🐶", "🐱", "🐼", "🦊", "🦋", "🌍", "🗺️", "✈️",
  ];

  const defaultEditor = () => ({
    ratio: "free",
    customRatioW: 4,
    customRatioH: 5,
    fit: "pad",
    padColor: "#ffffff",
    targetW: "",
    targetH: "",
    keepAspect: true,
    wallpaper: "",
    enhanceRes: false,
    quality: 92,
    forceJpeg: false,
    brightness: 0,
    contrast: 0,
    exposure: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    sharpness: 0,
    vignette: 0,
    grayscale: false,
    invert: false,
    sepia: false,
    filter: "none",
    rotate: 0,
    flipH: false,
    flipV: false,
    tiltH: 0,
    tiltV: 0,
    overlays: [],
    crop: null,
    photoX: null,
    photoY: null,
    photoW: null,
    photoH: null,
  });

  function uid() {
    return "f" + Math.random().toString(36).slice(2, 9);
  }

  function current() {
    return files.find((f) => f.id === currentId) || null;
  }

  function snapshot(item) {
    return JSON.parse(JSON.stringify(item.editor));
  }

  function pushHistory(item) {
    item.history = item.history.slice(0, item.historyIndex + 1);
    item.history.push(snapshot(item));
    item.historyIndex = item.history.length - 1;
  }

  function renderFormatIcons() {
    const box = $("formatIcons");
    box.innerHTML = ImageEngine.FORMATS.map(
      (f) => `<span class="format-chip" title="${f.ext} 사이즈 조정 가능">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="${f.color}"/><path d="M8 15l3-4 2 3 2-2 3 3" stroke="#fff" fill="none" stroke-width="1.6"/><circle cx="9" cy="8" r="1.3" fill="#fff"/></svg>
        ${f.ext}
      </span>`
    ).join("");
    $("fileInput").setAttribute("accept", "image/*," + ImageEngine.ACCEPT);
  }

  function renderStickers() {
    $("stickerGrid").innerHTML = STICKERS.map(
      (s) => `<button type="button" class="sticker" data-sticker="${s}">${s}</button>`
    ).join("");
  }

  function renderFilters() {
    const names = Object.keys(ImageEngine.FILTERS);
    const colors = {
      none: "#7f8c8d",
      vivid: "#e74c3c",
      soft: "#f5cba7",
      cool: "#5dade2",
      warm: "#e67e22",
      noir: "#1c1c1c",
      invert: "#9b59b6",
      mono: "#95a5a6",
      sepia: "#c39b6a",
      film: "#6d4c41",
      fade: "#d5d8dc",
      punch: "#c0392b",
      moonlight: "#1a365d",
      sunrise: "#f4d03f",
      ocean: "#1abc9c",
      forest: "#1e8449",
      candy: "#ff6b9d",
      silver: "#bdc3c7",
      drama: "#2c3e50",
      pastel: "#f9e79f",
      retro: "#b9770e",
      polaroid: "#fad7a0",
      night: "#0b1d36",
      bloom: "#f5b7b1",
      ink: "#111",
    };
    $("filterGrid").innerHTML = names
      .map(
        (n) =>
          `<button type="button" class="filter-card" data-filter="${n}" style="background:${colors[n] || "#34495e"}">${n}</button>`
      )
      .join("");
  }

  async function addFiles(fileList) {
    const incoming = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg|ico|avif|tiff?|jfif|apng|heic)$/i.test(f.name));
    for (const file of incoming) {
      const url = URL.createObjectURL(file);
      let img;
      try {
        img = await ImageEngine.loadImage(url);
      } catch {
        alert(`${file.name} 은(는) 이 브라우저에서 열 수 없습니다.`);
        continue;
      }
      const item = {
        id: uid(),
        file,
        url,
        img,
        originalImg: img,
        progress: 0,
        status: "대기",
        resultBlob: null,
        resultName: null,
        editor: defaultEditor(),
        history: [],
        historyIndex: -1,
        checkpoints: [],
        assets: [{ type: "original", label: "원본 사진", name: file.name, url }],
      };
      item.history.push(snapshot(item));
      item.historyIndex = 0;
      files.push(item);
      if (!currentId) currentId = item.id;
    }
    $("dropzone").classList.add("hidden");
    $("editorWrap").classList.remove("hidden");
    renderFileList();
    renderQuad();
    await preview();
    renderAssets();
  }

  function renderFileList() {
    $("fileList").innerHTML = files
      .map(
        (f) => `<li class="file-item ${f.id === currentId ? "active" : ""}" data-id="${f.id}">
          <input type="checkbox" class="file-check" data-check="${f.id}" ${f.checked ? "checked" : ""} />
          <img src="${f.url}" alt="" />
          <div class="file-meta">
            <div class="file-name" title="${f.file.name}">${f.file.name}</div>
            <div class="progress"><span style="width:${f.progress}%"></span></div>
            <div class="file-actions">
              <span class="status">${f.status}${f.progress ? " " + f.progress + "%" : ""}</span>
              <button type="button" class="btn ghost dl" ${f.resultBlob ? "" : "disabled"} data-dl="${f.id}">다운로드</button>
            </div>
          </div>
        </li>`
      )
      .join("");
    updateZipButton();
  }

  function updateZipButton() {
    $("btnZip").disabled = !files.some((f) => f.resultBlob);
  }

  function readUiInto(item) {
    const e = item.editor;
    e.ratio = document.querySelector("#ratioGrid .chip.active")?.dataset.ratio || "free";
    e.customRatioW = $("customRatioW").value;
    e.customRatioH = $("customRatioH").value;
    e.fit = document.querySelector("#fitMode .seg-btn.active")?.dataset.fit || "pad";
    e.padColor = $("padColor").value;
    e.targetW = $("targetW").value;
    e.targetH = $("targetH").value;
    e.keepAspect = $("keepAspect").checked;
    e.wallpaper = $("wallpaperPreset").value;
    e.enhanceRes = $("enhanceRes").checked;
    e.quality = Number($("quality").value);
    e.forceJpeg = $("forceJpeg").checked;
    e.brightness = Number($("brightness").value);
    e.contrast = Number($("contrast").value);
    e.exposure = Number($("exposure").value);
    e.highlights = Number($("highlights").value);
    e.shadows = Number($("shadows").value);
    e.saturation = Number($("saturation").value);
    e.temperature = Number($("temperature").value);
    e.tint = Number($("tint").value);
    e.sharpness = Number($("sharpness").value);
    e.vignette = Number($("vignette").value);
    e.grayscale = $("grayscale").checked;
    e.invert = $("invert").checked;
    e.sepia = $("sepia").checked;
    e.tiltH = Number($("tiltH").value);
    e.tiltV = Number($("tiltV").value);
  }

  function writeUiFrom(item) {
    const e = item.editor;
    document.querySelectorAll("#ratioGrid .chip").forEach((c) => c.classList.toggle("active", c.dataset.ratio === e.ratio));
    $("customRatioW").value = e.customRatioW;
    $("customRatioH").value = e.customRatioH;
    document.querySelectorAll("#fitMode .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.fit === e.fit));
    $("padColor").value = e.padColor;
    $("targetW").value = e.targetW;
    $("targetH").value = e.targetH;
    $("keepAspect").checked = e.keepAspect;
    $("wallpaperPreset").value = e.wallpaper;
    $("enhanceRes").checked = e.enhanceRes;
    $("quality").value = e.quality;
    $("qualityVal").textContent = e.quality + "%";
    $("forceJpeg").checked = e.forceJpeg;
    $("brightness").value = e.brightness;
    $("contrast").value = e.contrast;
    $("exposure").value = e.exposure;
    $("highlights").value = e.highlights;
    $("shadows").value = e.shadows;
    $("saturation").value = e.saturation;
    $("temperature").value = e.temperature;
    $("tint").value = e.tint;
    $("sharpness").value = e.sharpness;
    $("vignette").value = e.vignette;
    $("grayscale").checked = e.grayscale;
    $("invert").checked = e.invert;
    $("sepia").checked = e.sepia;
    $("tiltH").value = e.tiltH;
    $("tiltV").value = e.tiltV;
    if ($("tiltHVal")) $("tiltHVal").textContent = e.tiltH + "°";
    if ($("tiltVVal")) $("tiltVVal").textContent = e.tiltV + "°";
    document.querySelectorAll(".filter-card").forEach((c) => c.classList.toggle("active", c.dataset.filter === e.filter));
    renderCheckpoints(item);
    syncHud(item);
  }

  function syncHud(item) {
    if (!$("hudW")) return;
    const e = item.editor;
    $("hudW").value = Math.round(e.photoW || item.img.width || 0);
    $("hudH").value = Math.round(e.photoH || item.img.height || 0);
    $("targetW").value = e.photoW || "";
    $("targetH").value = e.photoH || "";
    $("hudOrigin").textContent = `원본 ${item.img.width} × ${item.img.height}`;
  }

  function renderCheckpoints(item) {
    const sel = $("checkpointSelect");
    sel.innerHTML = `<option value="">저장된 지점…</option>` + item.checkpoints.map((c, i) => `<option value="${i}">${c.name}</option>`).join("");
  }

  function renderAssets() {
    if (!files.length) {
      $("assetList").innerHTML = `<div class="asset-card"><div class="asset-thumb">📂</div><b>아직 없음</b><span class="sub">사진을 올리면 여기에 크게 보입니다. 카드를 누르면 그 사진으로 이동합니다.</span></div>`;
      return;
    }
    const photos = files
      .map(
        (f) => `<article class="asset-card ${f.id === currentId ? "just-added" : ""}" data-open="${f.id}">
          <div class="asset-thumb"><img src="${f.url}" alt="" /></div>
          <b>업로드한 사진</b>
          <span class="sub">${f.file.name}<br>${f.img.width} × ${f.img.height} px</span>
          <button type="button" class="btn primary" data-open="${f.id}">이 사진 편집</button>
        </article>`
      )
      .join("");
    const item = current();
    const extras = item
      ? item.assets
          .filter((a) => a.type !== "original")
          .map((a, i) => {
            const thumb = a.url ? `<img src="${a.url}" alt="" />` : `<span>${a.preview || a.text || "Aa"}</span>`;
            return `<article class="asset-card" data-asset="${i}">
              <div class="asset-thumb">${thumb}</div>
              <b>${a.label}</b>
              <span class="sub">${a.name || a.text || ""}</span>
              <button type="button" class="btn primary" data-put="${i}">사진에 넣기</button>
            </article>`;
          })
          .join("")
      : "";
    $("assetList").innerHTML = photos + extras;
  }

  function toastAsset(msg) {
    const el = $("assetToast");
    if (!el) return;
    el.textContent = msg;
    clearTimeout(toastAsset._t);
    toastAsset._t = setTimeout(() => {
      el.textContent = "";
    }, 2200);
  }

  function renderQuad() {
    $("quadPick").innerHTML = [0, 1, 2, 3]
      .map((i) => {
        const id = quadSlots[i];
        const f = files.find((x) => x.id === id);
        return `<div class="quad-slot" data-slot="${i}">${f ? `<img src="${f.url}" alt="" />` : i + 1 + "칸 선택"}</div>`;
      })
      .join("");
  }

  async function rasterPhoto(item) {
    if (item._raster) return item._raster;
    const e = item.editor;
    let canvas = ImageEngine.fitToRatio(
      item.img,
      ImageEngine.parseRatio(e.ratio, e.customRatioW, e.customRatioH),
      e.fit,
      e.padColor
    );
    if (e.crop) canvas = ImageEngine.cropCanvas(canvas, e.crop);
    canvas = ImageEngine.rotateFlip(canvas, e.rotate, e.flipH, e.flipV);
    canvas = ImageEngine.tilt(canvas, e.tiltH, e.tiltV);
    canvas = ImageEngine.applyAdjustments(canvas, e);
    if (e.filter && e.filter !== "none") canvas = ImageEngine.applyFilter(canvas, e.filter);
    if (e.enhanceRes) canvas = ImageEngine.resizeCanvas(canvas, canvas.width * 1.4, canvas.height * 1.4, true);
    item._raster = canvas;
    return canvas;
  }

  function ensurePhotoBox(item, raster, pageW, pageH) {
    const e = item.editor;
    if (e.photoW > 0 && e.photoH > 0) return;
    const fit = Math.min((pageW * 0.84) / raster.width, (pageH * 0.84) / raster.height, 3);
    const s = Number.isFinite(fit) && fit > 0 ? fit : 1;
    e.photoW = Math.max(160, Math.round(raster.width * s * viewZoom));
    e.photoH = Math.max(120, Math.round(raster.height * s * viewZoom));
    e.photoX = Math.round((pageW - e.photoW) / 2);
    e.photoY = Math.round((pageH - e.photoH) / 2);
  }

  function pageSize() {
    const stage = $("canvasStage");
    return { w: Math.max(40, Math.floor(stage.clientWidth)), h: Math.max(40, Math.floor(stage.clientHeight)) };
  }

  function mapPt(p, e, mode) {
    if (mode === "photo") return { x: p.x - e.photoX, y: p.y - e.photoY };
    return { x: p.x + e.photoX, y: p.y + e.photoY };
  }

  async function paintOverlays(ctx, overlays, dx, dy, skipInpaint) {
    for (const ov of overlays) {
      if (skipInpaint && ov.tool === "inpaint") continue;
      const x = (ov.x ?? 0) + dx;
      const y = (ov.y ?? 0) + dy;
      if (ov.type === "text" || ov.type === "signature") {
        ctx.save();
        ctx.textBaseline = "top";
        ctx.translate(x, y);
        ctx.rotate(((ov.angle || 0) * Math.PI) / 180);
        ctx.fillStyle = ov.color;
        const fontSize = ov.h || ov.size;
        ctx.font = `${ov.italic ? "italic " : ""}${fontSize}px ${ov.font}`;
        if (!ov.w) ov.w = Math.max(24, ctx.measureText(ov.text).width);
        if (!ov.h) ov.h = fontSize * 1.25;
        ctx.fillText(ov.text, 0, 0);
        ctx.restore();
      } else if (ov.type === "sticker") {
        if (!ov.w) ov.w = ov.size || 72;
        if (!ov.h) ov.h = ov.size || 72;
        ctx.textBaseline = "top";
        ctx.font = `${ov.h}px "Segoe UI Emoji","Apple Color Emoji","Noto Sans KR"`;
        ctx.fillText(ov.text, x, y);
      } else if (ov.type === "draw") {
        ctx.save();
        ctx.strokeStyle = ov.color;
        ctx.lineWidth = ov.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = ov.alpha ?? 1;
        if (ov.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ov.points.forEach((p, i) => {
          const px = p.x + dx;
          const py = p.y + dy;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      } else if (ov.type === "line") {
        ctx.strokeStyle = ov.color;
        ctx.lineWidth = ov.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ov.x1 + dx, ov.y1 + dy);
        ctx.lineTo(ov.x2 + dx, ov.y2 + dy);
        ctx.stroke();
      } else if (ov.type === "wm-text") {
        ImageEngine.drawWatermarkText(ctx, ov.text, ov);
      } else if (ov.type === "wm-image" && ov.url) {
        const img = await ImageEngine.loadImage(ov.url);
        ImageEngine.drawWatermarkImage(ctx, img, ov.opacity);
      } else if (ov.type === "image" && ov.url) {
        const img = await ImageEngine.loadImage(ov.url);
        ctx.drawImage(img, x, y, ov.w, ov.h);
      }
    }
  }

  async function compose(item, opts = {}) {
    const raster = await rasterPhoto(item);
    const e = item.editor;
    const { canvas, ctx } = ImageEngine.canvasFrom(raster.width, raster.height);
    ctx.drawImage(raster, 0, 0);
    if (!opts.skipOverlays) await paintOverlays(ctx, e.overlays, 0, 0, opts.skipInpaint);
    const tw = Math.max(1, Math.round(Number(e.photoW) || Number(e.targetW) || raster.width));
    const th = Math.max(1, Math.round(Number(e.photoH) || Number(e.targetH) || raster.height));
    if (tw !== raster.width || th !== raster.height) return ImageEngine.resizeCanvas(canvas, tw, th, e.enhanceRes);
    return canvas;
  }

  function placePhotoBox(item) {
    const box = $("photoBox");
    const e = item.editor;
    box.style.left = (e.photoX || 0) + "px";
    box.style.top = (e.photoY || 0) + "px";
    box.style.width = Math.max(24, e.photoW || 100) + "px";
    box.style.height = Math.max(24, e.photoH || 100) + "px";
    box.classList.toggle("selected", selectedPhoto && !selectedOv);
    $("photoSizeTag").textContent = `${Math.round(e.photoW)} × ${Math.round(e.photoH)} px`;
  }

  async function preview() {
    const item = current();
    if (!item) return;
    if (selectedOv && !item.editor.overlays.includes(selectedOv)) selectedOv = null;
    const page = pageSize();
    const raster = await rasterPhoto(item);
    ensurePhotoBox(item, raster, page.w, page.h);
    const c = $("photoCanvas");
    c.width = raster.width;
    c.height = raster.height;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(raster, 0, 0);
    await paintOverlays(ctx, item.editor.overlays, 0, 0, false);
    placePhotoBox(item);
    syncHud(item);
    $("zoomLabel").textContent = Math.round(viewZoom * 100) + "%";
    drawChrome();
  }

  function layoutCanvas() {
    preview();
  }

  function canvasPoint(ev) {
    const c = $("photoCanvas");
    const r = c.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;
    return {
      x: (ev.clientX - r.left) * (c.width / w),
      y: (ev.clientY - r.top) * (c.height / h),
    };
  }

  function stagePoint(ev) {
    const stage = $("canvasStage");
    const r = stage.getBoundingClientRect();
    return {
      x: ev.clientX - r.left + stage.scrollLeft,
      y: ev.clientY - r.top + stage.scrollTop,
    };
  }

  function activeTool() {
    return document.querySelector("#drawTools .seg-btn.active")?.dataset.tool || "select";
  }

  function overlayBox(ov) {
    if (!ov || ov.w == null || ov.h == null) return null;
    return { x: ov.x, y: ov.y, w: ov.w, h: ov.h };
  }

  function selectionBox(item) {
    if (selectedOv) return overlayBox(selectedOv);
    return null;
  }

  function isMovable(ov) {
    return ov && ["sticker", "text", "signature", "image"].includes(ov.type);
  }

  function handleMap(box) {
    const { x, y, w, h } = box;
    return {
      nw: [x, y],
      n: [x + w / 2, y],
      ne: [x + w, y],
      e: [x + w, y + h / 2],
      se: [x + w, y + h],
      s: [x + w / 2, y + h],
      sw: [x, y + h],
      w: [x, y + h / 2],
    };
  }

  function hitHandle(box, p, scale) {
    const r = Math.max(8, 10 / scale);
    const map = handleMap(box);
    return Object.keys(map).find((k) => Math.hypot(p.x - map[k][0], p.y - map[k][1]) <= r) || null;
  }

  function viewScale() {
    const c = $("photoCanvas");
    const r = c.getBoundingClientRect();
    return r.width / Math.max(1, c.width);
  }

  function drawChrome() {
    const over = $("photoCanvas");
    const ctx = over.getContext("2d");
    const item = current();
    if (!item) return;
    if (activeTool() === "crop" && cropRect) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, over.width, over.height);
      ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    }
    const stroke = dragOverlay?.stroke;
    if (stroke) {
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = stroke.alpha ?? 1;
      ctx.beginPath();
      stroke.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }
    if (lineStart && lastPt && activeTool() === "line") {
      ctx.strokeStyle = $("drawColor").value;
      ctx.lineWidth = Number($("drawSize").value);
      ctx.beginPath();
      ctx.moveTo(lineStart.x, lineStart.y);
      ctx.lineTo(lastPt.x, lastPt.y);
      ctx.stroke();
    }
    const box = selectionBox(current());
    if (!box) return;
    const lw = 1.5;
    ctx.save();
    ctx.strokeStyle = "#1e6fd9";
    ctx.lineWidth = lw;
    ctx.setLineDash([6 / viewScale(), 4 / viewScale()]);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#003087";
    const hs = Math.max(6, 8 / viewScale());
    const map = handleMap(box);
    Object.values(map).forEach(([hx, hy]) => {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
    const label = `${Math.round(box.w)} × ${Math.round(box.h)} px`;
    ctx.font = `${Math.max(12, 13 / viewScale())}px "Noto Sans KR"`;
    ctx.textBaseline = "bottom";
    const tw = ctx.measureText(label).width + 10;
    const lx = box.x;
    const ly = Math.max(16, box.y - 6);
    ctx.fillStyle = "rgba(0, 48, 135, 0.9)";
    ctx.fillRect(lx, ly - 18, tw, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, lx + 5, ly - 3);
    ctx.restore();
  }

  async function processItem(item) {
    item.status = "작업 중";
    item.progress = 8;
    renderFileList();
    await wait(40);
    item.progress = 35;
    renderFileList();
    const canvas = await compose(item, true);
    item.progress = 70;
    renderFileList();
    const { blob, name } = await ImageEngine.exportBlob(canvas, item.editor.quality, item.editor.forceJpeg, item.file.name);
    item.resultBlob = blob;
    item.resultName = name;
    item.progress = 100;
    item.status = "완료";
    renderFileList();
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function bindUi() {
    $("btnPick").onclick = () => $("fileInput").click();
    $("btnAddMore").onclick = () => $("fileInput").click();
    $("fileInput").onchange = (e) => addFiles(e.target.files);
    const dz = $("dropzone");
    ["dragenter", "dragover"].forEach((ev) =>
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.remove("dragover");
      })
    );
    dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", (e) => {
      if (e.target.closest("#dropzone")) return;
      e.preventDefault();
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    });

    $("fileList").onclick = async (e) => {
      const chk = e.target.closest(".file-check");
      if (chk) {
        const f = files.find((x) => x.id === chk.dataset.check);
        if (f) f.checked = chk.checked;
        e.stopPropagation();
        return;
      }
      const dl = e.target.closest("[data-dl]");
      if (dl && !dl.disabled) {
        const f = files.find((x) => x.id === dl.dataset.dl);
        if (f?.resultBlob) downloadBlob(f.resultBlob, f.resultName);
        return;
      }
      const row = e.target.closest(".file-item");
      if (!row) return;
      currentId = row.dataset.id;
      selectedOv = null;
      writeUiFrom(current());
      renderFileList();
      renderAssets();
      await preview();
    };

    $("chkAllFiles").onchange = () => {
      files.forEach((f) => (f.checked = $("chkAllFiles").checked));
      renderFileList();
    };
    $("btnDeleteSelected").onclick = async () => {
      const picked = files.filter((f) => f.checked);
      if (!picked.length) {
        alert("지울 사진을 왼쪽에서 선택하세요.");
        return;
      }
      if (!confirm(`선택한 ${picked.length}장을 목록에서 삭제할까요?`)) return;
      picked.forEach((f) => {
        const i = files.indexOf(f);
        if (i >= 0) files.splice(i, 1);
      });
      if (!files.find((f) => f.id === currentId)) currentId = files[0]?.id || null;
      if (!files.length) {
        $("editorWrap").classList.add("hidden");
        $("dropzone").classList.remove("hidden");
      }
      renderFileList();
      renderAssets();
      renderQuad();
      if (current()) {
        writeUiFrom(current());
        await preview();
      }
    };

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        document.querySelectorAll(".tab-body").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== tab.dataset.tab));
      };
    });

    $("ratioGrid").onclick = (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      document.querySelectorAll("#ratioGrid .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      commit();
    };
    $("fitMode").onclick = (e) => {
      const b = e.target.closest(".seg-btn");
      if (!b) return;
      document.querySelectorAll("#fitMode .seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      commit();
    };

    [
      "padColor",
      "keepAspect",
      "wallpaperPreset",
      "enhanceRes",
      "quality",
      "forceJpeg",
      "brightness",
      "contrast",
      "exposure",
      "highlights",
      "shadows",
      "saturation",
      "temperature",
      "tint",
      "sharpness",
      "vignette",
      "grayscale",
      "invert",
      "sepia",
      "tiltH",
      "tiltV",
      "customRatioW",
      "customRatioH",
    ].forEach((id) => {
      $(id).addEventListener("input", () => {
        $("qualityVal").textContent = $("quality").value + "%";
        if ($("tiltHVal")) $("tiltHVal").textContent = $("tiltH").value + "°";
        if ($("tiltVVal")) $("tiltVVal").textContent = $("tiltV").value + "°";
        if (id === "customRatioW" || id === "customRatioH") {
          document.querySelectorAll("#ratioGrid .chip").forEach((c) => c.classList.toggle("active", c.dataset.ratio === "custom"));
        }
        liveCommit();
      });
      $(id).addEventListener("change", commit);
    });

    $("wallpaperPreset").addEventListener("change", () => {
      const item = current();
      const v = $("wallpaperPreset").value;
      if (!item || !v) return;
      const [w, h] = v.split("x").map(Number);
      item.editor.photoW = w;
      item.editor.photoH = h;
      syncHud(item);
    });

    $("stickerSize").oninput = () => {
      $("stickerSizeVal").textContent = $("stickerSize").value + "px";
    };

    $("filterGrid").onclick = (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b || !current()) return;
      current().editor.filter = b.dataset.filter;
      document.querySelectorAll(".filter-card").forEach((c) => c.classList.toggle("active", c === b));
      commit();
    };

    $("btnAdjReset").onclick = () => {
      const item = current();
      if (!item) return;
      Object.assign(item.editor, {
        brightness: 0,
        contrast: 0,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        saturation: 0,
        temperature: 0,
        tint: 0,
        sharpness: 0,
        vignette: 0,
        grayscale: false,
        invert: false,
        sepia: false,
      });
      writeUiFrom(item);
      commit();
    };

    $("btnSizeReset").onclick = () => {
      const item = current();
      if (!item) return;
      Object.assign(item.editor, {
        ratio: "free",
        customRatioW: 4,
        customRatioH: 5,
        targetW: "",
        targetH: "",
        wallpaper: "",
        enhanceRes: false,
        keepAspect: true,
        photoX: null,
        photoY: null,
        photoW: null,
        photoH: null,
      });
      writeUiFrom(item);
      commit();
    };
    $("btnTiltReset").onclick = () => {
      const item = current();
      if (!item) return;
      Object.assign(item.editor, { tiltH: 0, tiltV: 0, rotate: 0, flipH: false, flipV: false });
      writeUiFrom(item);
      commit();
    };
    $("btnFilterReset").onclick = () => {
      const item = current();
      if (!item) return;
      item.editor.filter = "none";
      writeUiFrom(item);
      commit();
    };

    $("drawTools").onclick = (e) => {
      const b = e.target.closest(".seg-btn");
      if (!b) return;
      document.querySelectorAll("#drawTools .seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const hints = {
        select: "스티커·텍스트를 끌어 옮기고, 모서리·꼭짓점을 잡아 크기를 조절하세요.",
        crop: "드래그해서 자를 영역을 지정한 뒤 '자르기 적용'을 누르세요.",
        inpaint: "지울 영역을 칠한 뒤 '선택한 영역 자연스럽게 채우기'를 누르세요.",
        line: "시작점과 끝점을 드래그해 선을 그으세요.",
      };
      $("toolHint").textContent =
        hints[b.dataset.tool] || "사진 위에서 + 커서로 그리세요. 선은 커서 위치에 맞춰집니다.";
      $("photoCanvas").style.cursor = "crosshair";
    };

    const canvas = $("photoCanvas");
    const photoBox = $("photoBox");
    function applyResize(target, handle, p, start) {
      let x = start.x;
      let y = start.y;
      let w = start.w;
      let h = start.h;
      const dx = p.x - start.px;
      const dy = p.y - start.py;
      if (handle.includes("e")) w = Math.max(24, start.w + dx);
      if (handle.includes("s")) h = Math.max(24, start.h + dy);
      if (handle.includes("w")) {
        w = Math.max(24, start.w - dx);
        x = start.x + start.w - w;
      }
      if (handle.includes("n")) {
        h = Math.max(24, start.h - dy);
        y = start.y + start.h - h;
      }
      if ($("keepAspect").checked && start.w && start.h) {
        const ratio = start.w / start.h;
        if (handle === "n" || handle === "s") w = h * ratio;
        else h = w / ratio;
        if (handle.includes("w")) x = start.x + start.w - w;
        if (handle.includes("n")) y = start.y + start.h - h;
      }
      target.x = x;
      target.y = y;
      target.w = w;
      target.h = h;
    }
    photoBox.querySelectorAll(".handle").forEach((el) => {
      el.onpointerdown = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const item = current();
        if (!item) return;
        el.setPointerCapture(ev.pointerId);
        const s = stagePoint(ev);
        const e = item.editor;
        selectedOv = null;
        selectedPhoto = true;
        dragOverlay = {
          mode: "resizePhoto",
          handle: el.dataset.h,
          start: { x: e.photoX, y: e.photoY, w: e.photoW, h: e.photoH, px: s.x, py: s.y },
        };
      };
    });
    canvas.onpointerdown = (ev) => {
      const item = current();
      if (!item) return;
      canvas.setPointerCapture(ev.pointerId);
      const p = canvasPoint(ev);
      const tool = activeTool();
      const paint = ["brush", "pencil", "marker", "eraser", "inpaint", "crop", "line"].includes(tool);
      const box = selectionBox(item);
      if (!paint && box) {
        const handle = hitHandle(box, p, viewScale());
        if (handle) {
          dragOverlay = {
            mode: "resize",
            ov: selectedOv,
            handle,
            start: { x: selectedOv.x, y: selectedOv.y, w: selectedOv.w, h: selectedOv.h, px: p.x, py: p.y },
          };
          return;
        }
      }
      const hit = paint ? null : hitOverlay(item, p);
      if (hit) {
        selectedOv = hit;
        selectedPhoto = false;
        dragOverlay = { mode: "move", ov: hit, dx: p.x - hit.x, dy: p.y - hit.y };
        placePhotoBox(item);
        drawChrome();
        return;
      }
      if (!paint) {
        selectedOv = null;
        selectedPhoto = true;
        const s = stagePoint(ev);
        dragOverlay = { mode: "movePhoto", dx: s.x - item.editor.photoX, dy: s.y - item.editor.photoY };
        canvas.style.cursor = "grabbing";
        placePhotoBox(item);
        return;
      }
      drawing = true;
      lastPt = p;
      if (tool === "line") lineStart = p;
      if (tool === "crop") cropRect = { x: p.x, y: p.y, w: 0, h: 0 };
      if (["brush", "pencil", "marker", "eraser", "inpaint"].includes(tool)) {
        const ov = {
          type: "draw",
          tool,
          color: tool === "inpaint" ? "#ff4d4f" : $("drawColor").value,
          size: (Number($("drawSize").value) / Math.max(0.15, viewScale())) * (tool === "marker" ? 2.2 : tool === "pencil" ? 0.5 : 1),
          alpha: tool === "marker" ? 0.35 : tool === "pencil" ? 0.8 : 1,
          points: [p],
        };
        item.editor.overlays.push(ov);
        dragOverlay = { stroke: ov };
        preview().then(drawChrome);
      }
    };
    const onMove = (ev) => {
      const item = current();
      if (!item) return;
      if (dragOverlay?.mode === "resizePhoto") {
        const s = stagePoint(ev);
        const dummy = { x: 0, y: 0, w: 0, h: 0 };
        applyResize(dummy, dragOverlay.handle, s, dragOverlay.start);
        item.editor.photoX = dummy.x;
        item.editor.photoY = dummy.y;
        item.editor.photoW = dummy.w;
        item.editor.photoH = dummy.h;
        syncHud(item);
        placePhotoBox(item);
        return;
      }
      const p = canvasPoint(ev);
      lastPt = p;
      if (!dragOverlay && !drawing) {
        const box = selectionBox(item);
        const handle = box ? hitHandle(box, p, viewScale()) : null;
        const cursors = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
        canvas.style.cursor = handle ? cursors[handle] : hitOverlay(item, p) && activeTool() === "select" ? "move" : "crosshair";
      }
      if (dragOverlay?.mode === "move") {
        dragOverlay.ov.x = p.x - dragOverlay.dx;
        dragOverlay.ov.y = p.y - dragOverlay.dy;
        preview();
        return;
      }
      if (dragOverlay?.mode === "movePhoto") {
        const s = stagePoint(ev);
        item.editor.photoX = s.x - dragOverlay.dx;
        item.editor.photoY = s.y - dragOverlay.dy;
        placePhotoBox(item);
        return;
      }
      if (dragOverlay?.mode === "resize") {
        const st = dragOverlay.start;
        const dummy = { x: st.x, y: st.y, w: st.w, h: st.h };
        applyResize(dummy, dragOverlay.handle, p, st);
        if (dragOverlay.ov) {
          dragOverlay.ov.x = dummy.x;
          dragOverlay.ov.y = dummy.y;
          dragOverlay.ov.w = dummy.w;
          dragOverlay.ov.h = dummy.h;
          dragOverlay.ov.size = dummy.h;
        }
        preview();
        return;
      }
      if (!drawing) return;
      const tool = activeTool();
      if (tool === "crop" && cropRect) {
        cropRect.w = p.x - cropRect.x;
        cropRect.h = p.y - cropRect.y;
        preview().then(drawChrome);
        return;
      }
      if (dragOverlay?.stroke) {
        dragOverlay.stroke.points.push(p);
        preview().then(drawChrome);
      }
    };
    canvas.onpointermove = onMove;
    photoBox.addEventListener("pointermove", (ev) => {
      if (dragOverlay?.mode === "resizePhoto") onMove(ev);
    });
    const onUp = async (ev) => {
      const item = current();
      const p = canvasPoint(ev);
      if (activeTool() === "line" && lineStart && item) {
        item.editor.overlays.push({
          type: "line",
          color: $("drawColor").value,
          size: Number($("drawSize").value),
          x1: lineStart.x,
          y1: lineStart.y,
          x2: p.x,
          y2: p.y,
        });
        commit();
      } else if (dragOverlay?.stroke || dragOverlay?.ov || dragOverlay?.mode === "movePhoto" || dragOverlay?.mode === "resize" || dragOverlay?.mode === "resizePhoto") {
        if (item) pushHistory(item);
        await preview();
      }
      drawing = false;
      lineStart = null;
      dragOverlay = null;
      lastPt = null;
      if (canvas) canvas.style.cursor = "crosshair";
    };
    canvas.onpointerup = onUp;
    photoBox.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", (ev) => {
      if (dragOverlay?.mode === "resizePhoto" || dragOverlay?.mode === "movePhoto") onMove(ev);
    });
    window.addEventListener("pointerup", (ev) => {
      if (dragOverlay) onUp(ev);
    });

    $("btnApplyCrop").onclick = () => {
      const item = current();
      if (!item || !cropRect) return;
      const r = normalizeRect(cropRect);
      item.editor.crop = r;
      cropRect = null;
      commit();
    };

    $("btnInpaint").onclick = async () => {
      const item = current();
      if (!item) return;
      const strokes = item.editor.overlays.filter((o) => o.type === "draw" && o.tool === "inpaint");
      if (!strokes.length) {
        alert("먼저 '영역 지우기'로 지울 부분을 칠하세요.");
        return;
      }
      $("toolHint").textContent = "주변 색과 질감에 맞춰 채우는 중…";
      const base = await compose(item, { skipOverlays: true });
      const mask = ImageEngine.canvasFrom(base.width, base.height).canvas;
      const mctx = mask.getContext("2d");
      mctx.lineCap = "round";
      mctx.lineJoin = "round";
      mctx.strokeStyle = "#fff";
      strokes.forEach((o) => {
        mctx.lineWidth = o.size;
        mctx.beginPath();
        o.points.forEach((p, i) => (i ? mctx.lineTo(p.x, p.y) : mctx.moveTo(p.x, p.y)));
        mctx.stroke();
      });
      ImageEngine.inpaint(base, mask);
      item._raster = null;
      const baked = await ImageEngine.loadImage(base.toDataURL("image/png"));
      item.img = baked;
      item.originalImg = baked;
      item.url = base.toDataURL("image/png");
      Object.assign(item.editor, {
        ratio: "free",
        crop: null,
        rotate: 0,
        flipH: false,
        flipV: false,
        tiltH: 0,
        tiltV: 0,
        filter: "none",
        brightness: 0,
        contrast: 0,
        exposure: 0,
        highlights: 0,
        shadows: 0,
        saturation: 0,
        temperature: 0,
        tint: 0,
        sharpness: 0,
        vignette: 0,
        grayscale: false,
        invert: false,
        sepia: false,
        targetW: "",
        targetH: "",
        wallpaper: "",
      });
      item.editor.overlays = item.editor.overlays.filter((o) => o.tool !== "inpaint");
      writeUiFrom(item);
      $("toolHint").textContent = "영역을 주변과 맞춰 채웠습니다. 스티커는 그대로 위에 있습니다.";
      commit();
    };

    $("btnAddText").onclick = () => addTextLike("text");
    $("btnAddSign").onclick = () => addTextLike("signature");

    $("stickerGrid").onclick = (e) => {
      const b = e.target.closest("[data-sticker]");
      const item = current();
      if (!b || !item) return;
      const size = Number($("stickerSize").value) || 72;
      const ov = {
        type: "sticker",
        text: b.dataset.sticker,
        x: 40,
        y: 40,
        w: size,
        h: size,
        size,
      };
      item.editor.overlays.push(ov);
      selectedOv = ov;
      selectedPhoto = false;
      item.assets.push({ type: "sticker", label: "스티커", name: ov.text, preview: ov.text });
      document.querySelectorAll("#drawTools .seg-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === "select"));
      $("photoCanvas").style.cursor = "crosshair";
      renderAssets();
      toastAsset(`스티커 ${ov.text} 을(를) 사진에 넣었습니다`);
      commit();
    };

    $("btnWmText").onclick = () => {
      const item = current();
      if (!item) return;
      const text = $("wmText").value.trim() || "WATERMARK";
      item.editor.overlays.push({
        type: "wm-text",
        text,
        color: $("wmColor").value,
        size: Number($("wmSize").value),
        opacity: Number($("wmOpacity").value) / 100,
        tile: $("wmTile").checked,
      });
      item.assets.push({ type: "wm-text", label: "워터마크 글자", text });
      renderAssets();
      commit();
    };
    $("btnWmImage").onclick = () => $("wmImageInput").click();
    $("wmImageInput").onchange = async (e) => {
      const file = e.target.files[0];
      const item = current();
      if (!file || !item) return;
      const url = URL.createObjectURL(file);
      item.editor.overlays.push({ type: "wm-image", url, opacity: Number($("wmOpacity").value) / 100 });
      item.assets.push({ type: "wm-image", label: "워터마크 사진", name: file.name, url });
      renderAssets();
      commit();
    };

    $("btnRotL").onclick = () => rotate(-90);
    $("btnRotR").onclick = () => rotate(90);
    $("btnFlipH").onclick = () => {
      const i = current();
      if (!i) return;
      i.editor.flipH = !i.editor.flipH;
      commit();
    };
    $("btnFlipV").onclick = () => {
      const i = current();
      if (!i) return;
      i.editor.flipV = !i.editor.flipV;
      commit();
    };

    $("btnUndo").onclick = () => historyMove(-1);
    $("btnRedo").onclick = () => historyMove(1);
    $("btnCheckpoint").onclick = () => {
      const item = current();
      if (!item) return;
      item.checkpoints.push({
        name: `지점 ${item.checkpoints.length + 1}`,
        editor: snapshot(item),
      });
      renderCheckpoints(item);
    };
    $("checkpointSelect").onchange = async () => {
      const item = current();
      const idx = $("checkpointSelect").value;
      if (!item || idx === "") return;
      item.editor = JSON.parse(JSON.stringify(item.checkpoints[Number(idx)].editor));
      writeUiFrom(item);
      await preview();
    };
    $("btnReset").onclick = async () => {
      const item = current();
      if (!item) return;
      const keepProgress = { progress: item.progress, status: item.status, resultBlob: item.resultBlob, resultName: item.resultName };
      item.editor = defaultEditor();
      item.img = item.originalImg || item.img;
      item.url = item.file ? URL.createObjectURL(item.file) : item.url;
      item.history = [snapshot(item)];
      item.historyIndex = 0;
      Object.assign(item, keepProgress);
      writeUiFrom(item);
      await preview();
    };

    function scalePhoto(factor) {
      const item = current();
      if (!item) return;
      const e = item.editor;
      const cx = e.photoX + e.photoW / 2;
      const cy = e.photoY + e.photoH / 2;
      e.photoW = Math.max(40, e.photoW * factor);
      e.photoH = Math.max(40, e.photoH * factor);
      e.photoX = cx - e.photoW / 2;
      e.photoY = cy - e.photoH / 2;
      viewZoom = Math.min(4, Math.max(0.25, viewZoom * factor));
      preview();
    }
    $("btnZoomIn").onclick = () => scalePhoto(1.2);
    $("btnZoomOut").onclick = () => scalePhoto(1 / 1.2);
    $("btnZoomFit").onclick = () => {
      const item = current();
      if (!item) return;
      item.editor.photoW = null;
      item.editor.photoH = null;
      viewZoom = 1;
      preview();
    };

    const applyHudSize = () => {
      const item = current();
      if (!item) return;
      const w = Number($("hudW").value);
      const h = Number($("hudH").value);
      if (w > 0) item.editor.photoW = w;
      if (h > 0) item.editor.photoH = h;
      item.editor.targetW = w || "";
      item.editor.targetH = h || "";
      preview();
    };
    $("hudW").onchange = applyHudSize;
    $("hudH").onchange = applyHudSize;
    $("targetW").addEventListener("change", () => {
      $("hudW").value = $("targetW").value;
      applyHudSize();
    });
    $("targetH").addEventListener("change", () => {
      $("hudH").value = $("targetH").value;
      applyHudSize();
    });

    $("assetList").onclick = async (e) => {
      const open = e.target.closest("[data-open]");
      if (open) {
        currentId = open.dataset.open;
        selectedOv = null;
        selectedPhoto = true;
        writeUiFrom(current());
        renderFileList();
        renderAssets();
        toastAsset(`${current().file.name} 사진을 열었습니다`);
        await preview();
        return;
      }
      const btn = e.target.closest("[data-put]");
      const item = current();
      if (!btn || !item) return;
      const extras = item.assets.filter((a) => a.type !== "original");
      const a = extras[Number(btn.dataset.put)];
      if (!a) return;
      const card = btn.closest(".asset-card");
      const cx = 40;
      const cy = 40;
      if (a.type === "original") {
        item.editor.overlays.push({ type: "image", url: a.url, x: cx, y: cy, w: 220, h: 160 });
      } else if (a.type === "sticker") {
        const size = Number($("stickerSize")?.value) || 72;
        item.editor.overlays.push({ type: "sticker", text: a.name, x: cx, y: cy, w: size, h: size, size });
        selectedOv = item.editor.overlays[item.editor.overlays.length - 1];
        selectedPhoto = false;
      } else if (a.type === "text" || a.type === "signature") {
        item.editor.overlays.push({
          type: a.type,
          text: a.text,
          x: cx,
          y: cy,
          size: a.size || 42,
          w: (a.size || 42) * 4,
          h: (a.size || 42) * 1.25,
          color: a.color || "#111",
          font: a.font,
        });
        selectedOv = item.editor.overlays[item.editor.overlays.length - 1];
        selectedPhoto = false;
      } else if (a.type === "wm-text") {
        item.editor.overlays.push({
          type: "wm-text",
          text: a.text,
          color: $("wmColor").value,
          size: Number($("wmSize").value),
          opacity: 0.35,
          tile: true,
        });
      } else if (a.type === "wm-image") {
        item.editor.overlays.push({ type: "wm-image", url: a.url, opacity: 0.35 });
      }
      if (card) {
        card.classList.add("just-added");
        setTimeout(() => card.classList.remove("just-added"), 1200);
      }
      toastAsset(`${a.label}을(를) 사진에 넣었습니다`);
      commit();
    };

    $("quadPick").onclick = (e) => {
      const slot = e.target.closest(".quad-slot");
      if (!slot || !current()) return;
      quadSlots[Number(slot.dataset.slot)] = currentId;
      renderQuad();
    };
    $("btnCollage").onclick = async () => {
      const chosen = quadSlots.map((id) => files.find((f) => f.id === id)).filter(Boolean);
      if (chosen.length < 2) {
        alert("칸을 눌러 사진을 2~4장 배치하세요.");
        return;
      }
      const size = 1080;
      const { canvas, ctx } = ImageEngine.canvasFrom(size, size);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, size, size);
      const cells = [
        [0, 0],
        [size / 2, 0],
        [0, size / 2],
        [size / 2, size / 2],
      ];
      chosen.forEach((f, i) => {
        const [x, y] = cells[i];
        ctx.drawImage(f.img, x + 4, y + 4, size / 2 - 8, size / 2 - 8);
      });
      const url = canvas.toDataURL("image/png");
      const img = await ImageEngine.loadImage(url);
      const item = {
        id: uid(),
        file: new File([await (await fetch(url)).blob()], "collage_2x2.png", { type: "image/png" }),
        url,
        img,
        originalImg: img,
        progress: 0,
        status: "대기",
        resultBlob: null,
        resultName: null,
        editor: defaultEditor(),
        history: [],
        historyIndex: -1,
        checkpoints: [],
        assets: [{ type: "original", label: "사분할 원본", name: "collage_2x2.png", url }],
      };
      item.history.push(snapshot(item));
      item.historyIndex = 0;
      files.push(item);
      currentId = item.id;
      renderFileList();
      writeUiFrom(item);
      await preview();
    };

    $("btnProcessOne").onclick = async () => {
      const item = current();
      if (!item) return;
      await processItem(item);
    };
    $("btnProcessAll").onclick = async () => {
      for (const f of files) await processItem(f);
    };
    $("btnZip").onclick = () => {
      const ready = files.filter((f) => f.resultBlob);
      if (!ready.length) {
        alert("먼저 작업을 완료하세요.");
        return;
      }
      $("zipFileList").innerHTML = ready
        .map(
          (f) => `<li><label class="check"><input type="checkbox" data-zip="${f.id}" checked /> ${f.resultName}</label></li>`
        )
        .join("");
      $("zipModal").classList.remove("hidden");
    };
    $("btnZipCancel").onclick = () => $("zipModal").classList.add("hidden");
    $("btnZipConfirm").onclick = async () => {
      const ids = [...document.querySelectorAll("#zipFileList input:checked")].map((el) => el.dataset.zip);
      const picked = files.filter((f) => ids.includes(f.id) && f.resultBlob);
      if (!picked.length) {
        alert("받을 파일을 하나 이상 고르세요.");
        return;
      }
      $("zipModal").classList.add("hidden");
      if (typeof JSZip === "undefined") {
        picked.forEach((f) => downloadBlob(f.resultBlob, f.resultName));
        return;
      }
      const zip = new JSZip();
      picked.forEach((f) => zip.file(f.resultName, f.resultBlob));
      const blob = await zip.generateAsync({ type: "blob" });
      const filename = "resized_images_batch.zip";
      try {
        if (window.showSaveFilePicker) {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: "ZIP 파일", accept: { "application/zip": [".zip"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          downloadBlob(blob, filename);
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
        downloadBlob(blob, filename);
      }
    };

    window.addEventListener("resize", () => {
      if (current()) preview();
    });
  }

  function hitOverlay(item, p) {
    const list = [...item.editor.overlays].reverse();
    return list.find((o) => {
      if (!isMovable(o)) return false;
      if (o.w == null) {
        o.w = o.size || 72;
        o.h = o.size || 72;
      }
      return p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h;
    });
  }

  function normalizeRect(r) {
    const x = r.w < 0 ? r.x + r.w : r.x;
    const y = r.h < 0 ? r.y + r.h : r.y;
    return { x, y, w: Math.abs(r.w), h: Math.abs(r.h) };
  }

  function addTextLike(kind) {
    const item = current();
    if (!item) return;
    const isSign = kind === "signature";
    const text = (isSign ? $("signInput").value : $("textInput").value).trim() || (isSign ? "Signature" : "Text");
    const size = Number(isSign ? $("signSize").value : $("textSize").value);
    const ov = {
      type: kind,
      text,
      x: 40,
      y: isSign ? 80 : 40,
      size,
      w: size * Math.max(2, text.length * 0.6),
      h: size * 1.25,
      color: isSign ? $("signColor").value : $("textColor").value,
      font: isSign ? $("signFont").value : $("textFont").value,
      italic: isSign ? Number($("signItalic").value) : 0,
      angle: isSign ? Number($("signItalic").value) : 0,
    };
    item.editor.overlays.push(ov);
    selectedOv = ov;
    selectedPhoto = false;
    item.assets.push({ type: kind, label: isSign ? "서명" : "텍스트", text, size: ov.size, color: ov.color, font: ov.font });
    renderAssets();
    toastAsset(`${isSign ? "서명" : "텍스트"}을(를) 사진에 넣었습니다`);
    commit();
  }

  function rotate(delta) {
    const item = current();
    if (!item) return;
    item.editor.rotate = (item.editor.rotate + delta + 360) % 360;
    commit();
  }

  async function historyMove(dir) {
    const item = current();
    if (!item) return;
    const n = item.historyIndex + dir;
    if (n < 0 || n >= item.history.length) return;
    item.historyIndex = n;
    item.editor = JSON.parse(JSON.stringify(item.history[n]));
    item._raster = null;
    writeUiFrom(item);
    await preview();
  }

  let liveTimer = 0;
  function liveCommit() {
    const item = current();
    if (!item) return;
    readUiInto(item);
    item._raster = null;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(preview, 60);
  }

  async function commit() {
    const item = current();
    if (!item) return;
    readUiInto(item);
    item._raster = null;
    pushHistory(item);
    await preview();
  }

  renderFormatIcons();
  renderStickers();
  renderFilters();
  bindUi();
})();
