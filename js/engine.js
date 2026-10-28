const ImageEngine = (() => {
  const FORMATS = [
    { ext: "JPG", mime: "image/jpeg", color: "#e67e22" },
    { ext: "JPEG", mime: "image/jpeg", color: "#d35400" },
    { ext: "PNG", mime: "image/png", color: "#2980b9" },
    { ext: "GIF", mime: "image/gif", color: "#8e44ad" },
    { ext: "WEBP", mime: "image/webp", color: "#16a085" },
    { ext: "BMP", mime: "image/bmp", color: "#27ae60" },
    { ext: "SVG", mime: "image/svg+xml", color: "#f39c12" },
    { ext: "ICO", mime: "image/x-icon", color: "#34495e" },
    { ext: "AVIF", mime: "image/avif", color: "#1abc9c" },
    { ext: "TIF", mime: "image/tiff", color: "#7f8c8d" },
    { ext: "TIFF", mime: "image/tiff", color: "#95a5a6" },
    { ext: "JFIF", mime: "image/jpeg", color: "#e74c3c" },
    { ext: "APNG", mime: "image/apng", color: "#9b59b6" },
    { ext: "HEIC", mime: "image/heic", color: "#2c3e50" },
  ];

  const ACCEPT = FORMATS.map((f) => `.${f.ext.toLowerCase()}`).join(",");

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 열 수 없습니다."));
      img.src = src;
    });
  }

  function canvasFrom(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return { canvas: c, ctx };
  }

  function parseRatio(ratio, customW, customH) {
    if (!ratio || ratio === "free") return null;
    if (ratio === "custom") {
      const w = Number(customW) || 1;
      const h = Number(customH) || 1;
      return w / h;
    }
    const [a, b] = ratio.split(":").map(Number);
    return a / b;
  }

  function fitToRatio(img, ratioValue, mode, padColor) {
    const sw = img.width;
    const sh = img.height;
    if (!ratioValue) {
      const { canvas, ctx } = canvasFrom(sw, sh);
      ctx.drawImage(img, 0, 0);
      return canvas;
    }
    const srcRatio = sw / sh;
    let dw, dh, sx, sy, sWidth, sHeight;
    if (mode === "crop") {
      if (srcRatio > ratioValue) {
        sHeight = sh;
        sWidth = sh * ratioValue;
        sx = (sw - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = sw;
        sHeight = sw / ratioValue;
        sx = 0;
        sy = (sh - sHeight) / 2;
      }
      dw = sWidth;
      dh = sHeight;
      const { canvas, ctx } = canvasFrom(dw, dh);
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, dw, dh);
      return canvas;
    }
    if (srcRatio > ratioValue) {
      dw = sw;
      dh = sw / ratioValue;
    } else {
      dh = sh;
      dw = sh * ratioValue;
    }
    const { canvas, ctx } = canvasFrom(dw, dh);
    ctx.fillStyle = padColor || "#ffffff";
    ctx.fillRect(0, 0, dw, dh);
    ctx.drawImage(img, (dw - sw) / 2, (dh - sh) / 2);
    return canvas;
  }

  function resizeCanvas(src, tw, th, enhance) {
    if (!tw && !th) return src;
    const ratio = src.width / src.height;
    let w = tw;
    let h = th;
    if (w && !h) h = w / ratio;
    if (h && !w) w = h * ratio;
    if (enhance && w >= src.width && h >= src.height) {
      const { canvas, ctx } = canvasFrom(w, h);
      ctx.drawImage(src, 0, 0, w, h);
      sharpenCanvas(canvas, 0.45);
      return canvas;
    }
    const { canvas, ctx } = canvasFrom(w, h);
    ctx.drawImage(src, 0, 0, w, h);
    return canvas;
  }

  function rotateFlip(src, deg, flipH, flipV) {
    const rad = (deg * Math.PI) / 180;
    const swap = Math.abs(deg) % 180 === 90;
    const w = swap ? src.height : src.width;
    const h = swap ? src.width : src.height;
    const { canvas, ctx } = canvasFrom(w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return canvas;
  }

  function tilt(src, tiltH, tiltV) {
    if (!tiltH && !tiltV) return src;
    const extraW = Math.abs(src.height * Math.tan((tiltH * Math.PI) / 180));
    const extraH = Math.abs(src.width * Math.tan((tiltV * Math.PI) / 180));
    const w = src.width + extraW;
    const h = src.height + extraH;
    const { canvas, ctx } = canvasFrom(w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(1, Math.tan((tiltV * Math.PI) / 180), Math.tan((tiltH * Math.PI) / 180), 1, extraW / 2, extraH / 2);
    ctx.drawImage(src, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }

  function clamp(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function applyAdjustments(canvas, adj) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const b = adj.brightness / 100;
    const c = adj.contrast / 100;
    const e = adj.exposure / 100;
    const sat = adj.saturation / 100;
    const temp = adj.temperature / 100;
    const tint = adj.tint / 100;
    const hi = adj.highlights / 100;
    const sh = adj.shadows / 100;
    const contrastFactor = (1.015 + c) / (1.015 - c);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] / 255;
      let g = d[i + 1] / 255;
      let bch = d[i + 2] / 255;
      r = r * Math.pow(2, e);
      g = g * Math.pow(2, e);
      bch = bch * Math.pow(2, e);
      r += b;
      g += b;
      bch += b;
      r = (r - 0.5) * contrastFactor + 0.5;
      g = (g - 0.5) * contrastFactor + 0.5;
      bch = (bch - 0.5) * contrastFactor + 0.5;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bch;
      r += (r - lum) * sat;
      g += (g - lum) * sat;
      bch += (bch - lum) * sat;
      r += temp * 0.12;
      bch -= temp * 0.12;
      g += tint * 0.08;
      if (lum > 0.55) {
        const k = (lum - 0.55) / 0.45;
        r += hi * 0.15 * k;
        g += hi * 0.15 * k;
        bch += hi * 0.15 * k;
      } else {
        const k = (0.55 - lum) / 0.55;
        r += sh * 0.18 * k;
        g += sh * 0.18 * k;
        bch += sh * 0.18 * k;
      }
      if (adj.grayscale) {
        const y = 0.299 * r + 0.587 * g + 0.114 * bch;
        r = g = bch = y;
      }
      if (adj.sepia) {
        const nr = 0.393 * r + 0.769 * g + 0.189 * bch;
        const ng = 0.349 * r + 0.686 * g + 0.168 * bch;
        const nb = 0.272 * r + 0.534 * g + 0.131 * bch;
        r = nr;
        g = ng;
        bch = nb;
      }
      if (adj.invert) {
        r = 1 - r;
        g = 1 - g;
        bch = 1 - bch;
      }
      d[i] = clamp(r * 255);
      d[i + 1] = clamp(g * 255);
      d[i + 2] = clamp(bch * 255);
    }
    ctx.putImageData(img, 0, 0);
    if (adj.vignette > 0) applyVignette(canvas, adj.vignette / 100);
    if (adj.sharpness > 0) sharpenCanvas(canvas, adj.sharpness / 100);
    return canvas;
  }

  function applyVignette(canvas, amount) {
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.35,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.72
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${amount * 0.75})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function sharpenCanvas(canvas, amount) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data;
    const o = out.data;
    const k = amount * 1.6;
    const copy = (i) => {
      o[i] = s[i];
      o[i + 1] = s[i + 1];
      o[i + 2] = s[i + 2];
      o[i + 3] = s[i + 3];
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          copy(i);
          continue;
        }
        const up = ((y - 1) * w + x) * 4;
        const dn = ((y + 1) * w + x) * 4;
        const lf = (y * w + x - 1) * 4;
        const rt = (y * w + x + 1) * 4;
        for (let c = 0; c < 3; c++) {
          const v = s[i + c] * (1 + 4 * k) - (s[up + c] + s[dn + c] + s[lf + c] + s[rt + c]) * k;
          o[i + c] = clamp(v);
        }
        o[i + 3] = s[i + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  function pixelate(canvas, block) {
    if (!block || block <= 1) return canvas;
    const { canvas: small, ctx } = canvasFrom(Math.ceil(canvas.width / block), Math.ceil(canvas.height / block));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    const out = canvasFrom(canvas.width, canvas.height);
    out.ctx.imageSmoothingEnabled = false;
    out.ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    return out.canvas;
  }

  const FILTERS = {
    none: (c) => c,
    vivid: (c) => applyAdjustments(c, baseAdj({ saturation: 40, contrast: 18, sharpness: 15 })),
    soft: (c) => applyAdjustments(c, baseAdj({ contrast: -12, brightness: 8, saturation: -8 })),
    cool: (c) => applyAdjustments(c, baseAdj({ temperature: -45, tint: 8, contrast: 8 })),
    warm: (c) => applyAdjustments(c, baseAdj({ temperature: 50, saturation: 12, brightness: 4 })),
    noir: (c) => applyAdjustments(c, baseAdj({ grayscale: true, contrast: 28, vignette: 55, sharpness: 20 })),
    invert: (c) => applyAdjustments(c, baseAdj({ invert: true })),
    mono: (c) => applyAdjustments(c, baseAdj({ grayscale: true, contrast: 10 })),
    sepia: (c) => applyAdjustments(c, baseAdj({ sepia: true, temperature: 20 })),
    film: (c) => applyAdjustments(c, baseAdj({ contrast: 12, saturation: -15, vignette: 30, temperature: 15 })),
    fade: (c) => applyAdjustments(c, baseAdj({ contrast: -20, highlights: 25, saturation: -20 })),
    punch: (c) => applyAdjustments(c, baseAdj({ contrast: 30, saturation: 25, sharpness: 30 })),
    moonlight: (c) => applyAdjustments(c, baseAdj({ temperature: -35, contrast: 15, highlights: -20, vignette: 40 })),
    sunrise: (c) => applyAdjustments(c, baseAdj({ temperature: 40, tint: 10, highlights: 15, shadows: 10 })),
    ocean: (c) => applyAdjustments(c, baseAdj({ temperature: -30, saturation: 20, tint: -10 })),
    forest: (c) => applyAdjustments(c, baseAdj({ tint: 25, saturation: 10, contrast: 12 })),
    candy: (c) => applyAdjustments(c, baseAdj({ saturation: 55, contrast: 8, brightness: 6 })),
    silver: (c) => applyAdjustments(c, baseAdj({ grayscale: true, highlights: 20, shadows: -10 })),
    drama: (c) => applyAdjustments(c, baseAdj({ contrast: 40, shadows: -20, vignette: 45, sharpness: 25 })),
    pastel: (c) => applyAdjustments(c, baseAdj({ saturation: -25, brightness: 12, contrast: -8 })),
    retro: (c) => applyAdjustments(c, baseAdj({ sepia: true, contrast: 8, vignette: 25, saturation: -10 })),
    polaroid: (c) => applyAdjustments(c, baseAdj({ temperature: 18, contrast: -6, brightness: 10, vignette: 18 })),
    night: (c) => applyAdjustments(c, baseAdj({ brightness: -12, contrast: 22, temperature: -20, vignette: 50 })),
    bloom: (c) => applyAdjustments(c, baseAdj({ highlights: 35, brightness: 10, sharpness: -0 })),
    ink: (c) => applyAdjustments(c, baseAdj({ grayscale: true, contrast: 50, sharpness: 40 })),
  };

  function baseAdj(over) {
    return {
      brightness: 0,
      contrast: 0,
      exposure: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      sharpness: 0,
      vignette: 0,
      grayscale: false,
      invert: false,
      sepia: false,
      ...over,
    };
  }

  function cloneCanvas(src) {
    const { canvas, ctx } = canvasFrom(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    return canvas;
  }

  function applyFilter(canvas, name) {
    const fn = FILTERS[name] || FILTERS.none;
    return fn(cloneCanvas(canvas));
  }

  function cropCanvas(src, rect) {
    const x = Math.max(0, Math.round(rect.x));
    const y = Math.max(0, Math.round(rect.y));
    const w = Math.max(1, Math.round(rect.w));
    const h = Math.max(1, Math.round(rect.h));
    const { canvas, ctx } = canvasFrom(w, h);
    ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
    return canvas;
  }

  function inpaint(src, maskCanvas) {
    const w = src.width;
    const h = src.height;
    const sctx = src.getContext("2d", { willReadFrequently: true });
    const mctx = maskCanvas.getContext("2d", { willReadFrequently: true });
    const srcData = sctx.getImageData(0, 0, w, h);
    const maskPx = mctx.getImageData(0, 0, w, h).data;
    const d = srcData.data;
    const todo = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) todo[i] = maskPx[i * 4 + 3] > 18 ? 1 : 0;

    const dilated = new Uint8Array(todo);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!todo[y * w + x]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) dilated[(y + dy) * w + (x + dx)] = 1;
        }
      }
    }

    const filled = new Uint8Array(w * h);
    const dist = new Int16Array(w * h);
    dist.fill(32767);
    const q = [];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (dilated[i]) continue;
        filled[i] = 1;
        dist[i] = 0;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (dilated[ni]) {
            dist[ni] = 1;
            q.push(nx, ny);
          }
        }
      }
    }
    for (let qi = 0; qi < q.length; qi += 2) {
      const x = q[qi];
      const y = q[qi + 1];
      const i = y * w + x;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!dilated[ni] || dist[ni] <= dist[i] + 1) continue;
        dist[ni] = dist[i] + 1;
        q.push(nx, ny);
      }
    }
    const order = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (dilated[i]) order.push(i);
      }
    }
    order.sort((a, b) => dist[a] - dist[b]);

    const sample = (x, y) => {
      const i = (y * w + x) * 4;
      return [d[i], d[i + 1], d[i + 2]];
    };

    for (const i of order) {
      const x = i % w;
      const y = (i / w) | 0;
      let wr = 0;
      let wg = 0;
      let wb = 0;
      let wt = 0;
      for (let rad = 1; rad <= 12 && wt < 8; rad++) {
        for (const [dx, dy] of dirs) {
          const nx = x + dx * rad;
          const ny = y + dy * rad;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!filled[ni]) continue;
          const [r, g, b] = sample(nx, ny);
          const wgt = 1 / (rad * rad);
          wr += r * wgt;
          wg += g * wgt;
          wb += b * wgt;
          wt += wgt;
        }
      }
      if (wt > 0) {
        const pi = i * 4;
        d[pi] = wr / wt;
        d[pi + 1] = wg / wt;
        d[pi + 2] = wb / wt;
        filled[i] = 1;
      }
    }

    const searchR = Math.min(36, Math.max(16, (Math.min(w, h) / 8) | 0));
    const pr = 2;
    for (const i of order) {
      const x = i % w;
      const y = (i / w) | 0;
      let best = 1e15;
      let br = d[i * 4];
      let bg = d[i * 4 + 1];
      let bb = d[i * 4 + 2];
      const step = 2;
      for (let sy = y - searchR; sy <= y + searchR; sy += step) {
        for (let sx = x - searchR; sx <= x + searchR; sx += step) {
          if (sx < pr || sy < pr || sx >= w - pr || sy >= h - pr) continue;
          const si = sy * w + sx;
          if (dilated[si] && !filled[si]) continue;
          let ok = true;
          let ssd = 0;
          let n = 0;
          for (let dy = -pr; dy <= pr && ok; dy++) {
            for (let dx = -pr; dx <= pr; dx++) {
              const qx = x + dx;
              const qy = y + dy;
              const kx = sx + dx;
              const ky = sy + dy;
              if (qx < 0 || qy < 0 || qx >= w || qy >= h || kx < 0 || ky < 0 || kx >= w || ky >= h) continue;
              const qi = qy * w + qx;
              const ki = ky * w + kx;
              if (dilated[ki] && dist[ki] > dist[qi]) {
                ok = false;
                break;
              }
              if (!dilated[qi] || dist[qi] < dist[i]) {
                const a = qi * 4;
                const b = ki * 4;
                const dr = d[a] - d[b];
                const dg = d[a + 1] - d[b + 1];
                const db = d[a + 2] - d[b + 2];
                ssd += dr * dr + dg * dg + db * db;
                n++;
              }
            }
          }
          if (!ok || !n) continue;
          ssd /= n;
          if (ssd < best) {
            best = ssd;
            const p = si * 4;
            br = d[p];
            bg = d[p + 1];
            bb = d[p + 2];
          }
        }
      }
      const p = i * 4;
      d[p] = (d[p] * 0.35 + br * 0.65) | 0;
      d[p + 1] = (d[p + 1] * 0.35 + bg * 0.65) | 0;
      d[p + 2] = (d[p + 2] * 0.35 + bb * 0.65) | 0;
    }

    sctx.putImageData(srcData, 0, 0);
    return src;
  }

  function drawWatermarkText(ctx, text, opt) {
    ctx.save();
    ctx.globalAlpha = opt.opacity;
    ctx.fillStyle = opt.color;
    ctx.font = `${opt.size}px "Noto Sans KR", sans-serif`;
    if (opt.tile) {
      ctx.rotate(-0.35);
      for (let y = -ctx.canvas.height; y < ctx.canvas.height * 2; y += opt.size * 3) {
        for (let x = -ctx.canvas.width; x < ctx.canvas.width * 2; x += ctx.measureText(text).width + 80) {
          ctx.fillText(text, x, y);
        }
      }
    } else {
      ctx.fillText(text, 24, ctx.canvas.height - 24);
    }
    ctx.restore();
  }

  function drawWatermarkImage(ctx, img, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const w = ctx.canvas.width * 0.22;
    const h = (img.height / img.width) * w;
    ctx.drawImage(img, ctx.canvas.width - w - 16, ctx.canvas.height - h - 16, w, h);
    ctx.restore();
  }

  async function exportBlob(canvas, quality, forceJpeg, origName) {
    const q = Math.min(1, Math.max(0.4, quality / 100));
    const type = forceJpeg ? "image/jpeg" : "image/png";
    const blob = await new Promise((res) => canvas.toBlob(res, type, q));
    const base = origName.replace(/\.[^.]+$/, "");
    const ext = forceJpeg ? "jpg" : "png";
    const name = `${base}_resized.${ext}`;
    return { blob, name };
  }

  return {
    FORMATS,
    ACCEPT,
    FILTERS,
    loadImage,
    canvasFrom,
    parseRatio,
    fitToRatio,
    resizeCanvas,
    rotateFlip,
    tilt,
    applyAdjustments,
    pixelate,
    applyFilter,
    cropCanvas,
    inpaint,
    cloneCanvas,
    drawWatermarkText,
    drawWatermarkImage,
    exportBlob,
    baseAdj,
  };
})();
